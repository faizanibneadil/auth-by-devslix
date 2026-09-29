import type { CollectionConfig } from 'payload'
import { parseCookies } from 'payload/shared'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    loginWithUsername: {
      allowEmailLogin: true,
      requireUsername: true,
      requireEmail: false,
    },
    cookies: {
      domain: '.devslix.com', // Sab se important line: Cookie ab saare subdomains par chalegi
      sameSite: 'Lax',
      secure: true, // Production me HTTPS hona zaroori hai
    },
  },
  fields: [
    {
      name: 'googleId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'avatarUrl',
      type: 'text',
    },
    {
      name: 'authProvider',
      type: 'select',
      defaultValue: 'local',
      options: [
        { label: 'Local', value: 'local' },
        { label: 'Google', value: 'google' },
      ],
    },
  ],
  endpoints: [
    {
      path: '/verify-session',
      method: 'get',
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ authenticated: false }, { status: 401 })
        }

        const fullUser = await req.payload.findByID({
          collection: 'users',
          id: req.user.id,
        })

        if (!fullUser || !fullUser.email) {
          return Response.json({ authenticated: false, message: 'Email missing in central DB' }, { status: 401 })
        }

        return Response.json({
          authenticated: true,
          user: {
            id: fullUser.id,
            email: fullUser.email,
            username: fullUser.username || '',
            name: fullUser.username || fullUser.email.split('@')[0] || 'SSO User',
            avatarUrl: fullUser.avatarUrl || null,
            authProvider: fullUser.authProvider || 'local',
          },
        })
      },
    },
  ],
}
