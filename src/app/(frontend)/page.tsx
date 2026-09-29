'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface User {
  id: string
  email: string
  username?: string
  name?: string
  avatarUrl?: string | null
  authProvider?: string
}

function SSOForm() {
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect') || searchParams.get('redirect_uri') || ''

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sanitizeRedirect = (urlStr: string) => {
    if (!urlStr) return ''
    if (urlStr.startsWith('/') && !urlStr.startsWith('//')) return urlStr
    try {
      const parsed = new URL(urlStr)
      const allowedHosts = ['localhost', 'devslix.com']
      if (allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
        return urlStr
      }
    } catch {
      // invalid URL
    }
    return '/'
  }

  const safeRedirectParam = sanitizeRedirect(redirectParam)

  // Form states
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    setCheckingSession(true)
    try {
      const res = await fetch('/api/users/verify-session', {
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user) {
          setUser(data.user)
          // If user is logged in and redirect parameter exists, redirect to requested service
          if (safeRedirectParam) {
            window.location.href = safeRedirectParam
          }
        }
      }
    } catch (err) {
      console.error('Session check error:', err)
    } finally {
      setCheckingSession(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.includes('@') ? email : undefined,
          username: !email.includes('@') ? email : undefined,
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.errors?.[0]?.message || 'Invalid login credentials')
      }

      if (safeRedirectParam) {
        window.location.href = safeRedirectParam
      } else {
        await checkSession()
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username: username || email.split('@')[0],
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.errors?.[0]?.message || 'Registration failed')
      }

      // Automatically login user after registration
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      if (!loginRes.ok) {
        setMode('login')
        setError('Account created! Please log in.')
        return
      }

      if (redirectParam) {
        window.location.href = redirectParam
      } else {
        await checkSession()
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/users/logout', { method: 'POST' })
      setUser(null)
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setLoading(false)
    }
  }

  const googleAuthUrl = `/api/auth/google${safeRedirectParam ? `?redirect=${encodeURIComponent(safeRedirectParam)}` : ''}`
  const googleDemoUrl = `/api/auth/google?demo=true${safeRedirectParam ? `&redirect=${encodeURIComponent(safeRedirectParam)}` : ''}`

  const clipServiceUrl = process.env.NEXT_PUBLIC_CLIP_SERVICE_URL || 'http://localhost:3001'
  const playgroundServiceUrl = process.env.NEXT_PUBLIC_PLAYGROUND_SERVICE_URL || 'http://localhost:3002'
  const urlShortenerServiceUrl = process.env.NEXT_PUBLIC_URL_SHORTENER_SERVICE_URL || 'http://localhost:3003'

  if (checkingSession) {
    return (
      <div className="card">
        <div className="spinner">Checking SSO Authentication...</div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="card">
        <div className="profile-header">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name || user.email} className="avatar" />
          ) : (
            <div className="avatar-placeholder">{(user.name || user.email)[0].toUpperCase()}</div>
          )}
          <div>
            <h2>Welcome, {user.name || user.username || user.email}!</h2>
            <p className="email">{user.email}</p>
            <span className="badge">Auth Provider: {user.authProvider || 'Central SSO'}</span>
          </div>
        </div>

        {redirectParam && (
          <div className="redirect-alert">
            <p>You are authenticated. Redirecting you to target service...</p>
            <a href={redirectParam} className="btn btn-primary">
              Continue to Service
            </a>
          </div>
        )}

        <div className="services-section">
          <h3>Your Connected Ecosystem Services</h3>
          <p className="subtitle">One login unlocks access to all Devslix products:</p>
          <div className="services-grid">
            <a href={clipServiceUrl} className="service-card">
              <h4>📝 Clip</h4>
              <p>Instant Markdown notes editor & sharing</p>
            </a>
            <a href={playgroundServiceUrl} className="service-card">
              <h4>💻 Playground</h4>
              <p>Interactive HTML, CSS & JS playground</p>
            </a>
            <a href={urlShortenerServiceUrl} className="service-card">
              <h4>🔗 URL Shortener</h4>
              <p>Fast, trackable URL shortening service</p>
            </a>
          </div>
        </div>

        <button onClick={handleLogout} disabled={loading} className="btn btn-secondary logout-btn">
          {loading ? 'Logging out...' : 'Sign Out of Central SSO'}
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="header">
        <h1>Devslix Central SSO Auth</h1>
        <p>Sign in once to access Clip, Playground, URL Shortener & more</p>
      </div>

      {redirectParam && (
        <div className="sso-notice">
          ℹ️ Central login requested by connected service.
        </div>
      )}

      {error && <div className="error-alert">{error}</div>}

      <div className="oauth-buttons">
        <a href={googleAuthUrl} className="btn btn-google">
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Sign in with Google
        </a>

        <a href={googleDemoUrl} className="btn btn-google-demo">
          ⚡ Sign in with Google (Demo SSO)
        </a>
      </div>

      <div className="divider">
        <span>or use email & password</span>
      </div>

      <div className="tabs">
        <button
          className={`tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setMode('login')
            setError(null)
          }}
        >
          Sign In
        </button>
        <button
          className={`tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => {
            setMode('register')
            setError(null)
          }}
        >
          Create Account
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="form">
          <div className="form-group">
            <label>Email or Username</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@devslix.com"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@devslix.com"
            />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="devslix_user"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="container">
      <Suspense fallback={<div className="card">Loading SSO Portal...</div>}>
        <SSOForm />
      </Suspense>
    </div>
  )
}
