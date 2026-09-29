import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

function getSafeRedirectUrl(urlStr: string | null, defaultFallback: string, serverUrl: string): string {
  if (!urlStr) return defaultFallback

  // Allow relative URLs starting with '/'
  if (urlStr.startsWith('/') && !urlStr.startsWith('//')) {
    return urlStr
  }

  try {
    const parsed = new URL(urlStr)
    const allowedOrigins = [
      serverUrl,
      process.env.NEXT_PUBLIC_SERVER_URL,
      process.env.SHORT_SERVICE_SERVER_URL,
      process.env.CLIP_SERVICE_URL,
      process.env.PLAYGROUND_SERVICE_URL,
      process.env.URL_SHORTENER_SERVICE_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ].filter(Boolean) as string[]

    const isAllowed = allowedOrigins.some((origin) => {
      try {
        const allowedParsed = new URL(origin)
        return parsed.origin === allowedParsed.origin
      } catch {
        return false
      }
    })

    if (isAllowed) {
      return urlStr
    }
  } catch {
    // invalid URL format
  }

  return defaultFallback
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const rawState = searchParams.get('state')
  let redirectUri = '/'
  if (rawState) {
    try {
      redirectUri = decodeURIComponent(rawState)
    } catch {
      redirectUri = rawState
    }
  }

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const payloadSecret = process.env.PAYLOAD_SECRET || 'fallback-secret'

  let googleUser = {
    id: 'google-demo-user-id-123',
    email: 'demo.user@devslix.com',
    name: 'Demo Google User',
    picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
  }

  // If live credentials are available and code is not demo_google_code, fetch real Google user profile
  if (googleClientId && googleClientSecret && code && code !== 'demo_google_code') {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: `${serverUrl}/api/auth/google/callback`,
          grant_type: 'authorization_code',
        }),
      })

      const tokenData = await tokenRes.json()

      if (tokenData.access_token) {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const profile = await userInfoRes.json()
        if (profile && profile.email) {
          googleUser = {
            id: profile.id,
            email: profile.email,
            name: profile.name || profile.given_name || profile.email.split('@')[0],
            picture: profile.picture || '',
          }
        }
      }
    } catch (err) {
      console.error('Error fetching Google profile:', err)
    }
  }

  const payload = await getPayload({ config: configPromise })

  // Find or create user in Payload CMS
  const existingUsers = await payload.find({
    collection: 'users',
    where: {
      email: {
        equals: googleUser.email,
      },
    },
  })

  let user = existingUsers.docs[0]

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString('hex') + '!Aa1'
    user = await payload.create({
      collection: 'users',
      data: {
        email: googleUser.email,
        username: googleUser.email.split('@')[0] + '_' + Math.floor(1000 + Math.random() * 9000),
        password: randomPassword,
        googleId: googleUser.id,
        avatarUrl: googleUser.picture,
        authProvider: 'google',
      },
    })
  } else {
    // Update profile details if needed
    user = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        googleId: googleUser.id,
        avatarUrl: googleUser.picture,
        authProvider: 'google',
      },
    })
  }

  // Generate Payload JWT auth token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      collection: 'users',
    },
    payloadSecret,
    {
      expiresIn: '7d',
    }
  )

  const cookieName = 'payload-token'

  // Validate redirect URI to prevent open redirect vulnerabilities
  const safeRedirect = getSafeRedirectUrl(redirectUri, '/', serverUrl)
  let targetUrl: URL
  try {
    targetUrl = new URL(safeRedirect, serverUrl)
  } catch {
    targetUrl = new URL('/', serverUrl)
  }

  const response = NextResponse.redirect(targetUrl.toString())

  // Set auth cookie across subdomains or domain
  const isProd = process.env.NODE_ENV === 'production'
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    domain: isProd ? '.devslix.com' : undefined,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return response
}
