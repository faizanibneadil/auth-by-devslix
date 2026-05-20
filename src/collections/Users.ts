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
    // Email added by default
    // Add more fields as needed
  ],
  endpoints: [{
    path: '/verify-session',
    method: 'get',
    handler: async (req) => {
      console.log({
        userFromAnotherService: req.user,
        headers: req.headers.get('cookie'),
        cookie: parseCookies(req.headers)
      })
      // Agar payload context me user nahi mila
      if (!req.user) {
        return Response.json({ authenticated: false }, { status: 401 })
      }

      // Payload local API se database se user ka fresh record nikallein ID ke zariye
      // Taake email har haal me mile, chahe token me ho ya na ho
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
          name: fullUser.username || 'SSO User',
        }
      })
    }
  }]
}
