import type { CollectionConfig } from 'payload'

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
    // Email added by default
    // Add more fields as needed
  ],
  endpoints: [{
    path: '/verify-session',
    method: 'get',
    handler: async (req) => {
      console.log({ user: req.user })
      if (!req.user) {
        return Response.json({ authenticated: false }, {
          status: 401
        })
      }

      return Response.json({
        authenticated: true,
        user: req.user
      })
    }
  }]
}
