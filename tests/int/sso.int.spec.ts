import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as googleInitRoute } from '../../src/app/api/auth/google/route'

describe('SSO Auth Endpoints', () => {
  it('should redirect to callback with demo state when demo=true', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/google?demo=true&redirect=http://localhost:3001/dashboard')
    const res = await googleInitRoute(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/api/auth/google/callback')
    expect(location).toContain('code=demo_google_code')
    expect(location).toContain('http%3A%2F%2Flocalhost%3A3001%2Fdashboard')
  })

  it('should construct Google OAuth authorization URL when GOOGLE_CLIENT_ID is provided', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    const req = new NextRequest('http://localhost:3000/api/auth/google?redirect=http://localhost:3002')
    const res = await googleInitRoute(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(location).toContain('client_id=test-client-id')
    delete process.env.GOOGLE_CLIENT_ID
  })
})
