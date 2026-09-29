import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const redirectUri = searchParams.get('redirect_uri') || searchParams.get('redirect') || '/'
  const isDemo = searchParams.get('demo') === 'true'

  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  // Standardize state param containing target redirect
  const state = encodeURIComponent(redirectUri)

  // If live Google Client ID is not provided or demo parameter is set, use dummy / demo flow directly
  if (!googleClientId || isDemo) {
    const callbackUrl = new URL('/api/auth/google/callback', serverUrl)
    callbackUrl.searchParams.set('code', 'demo_google_code')
    callbackUrl.searchParams.set('state', redirectUri)
    return NextResponse.redirect(callbackUrl.toString())
  }

  // Live Google OAuth flow
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', googleClientId)
  googleAuthUrl.searchParams.set('redirect_uri', `${serverUrl}/api/auth/google/callback`)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('state', state)

  return NextResponse.redirect(googleAuthUrl.toString())
}
