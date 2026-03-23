import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      image?: string
      provider?: 'github' | 'google'
    }
    accessToken?: string
    /** The raw NextAuth session JWT — used as Bearer token for the Worker API */
    sessionToken?: string
  }

  interface User {
    id: string
    name: string
    email: string
    image?: string
    provider?: 'github' | 'google'
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: 'github' | 'google'
    accessToken?: string
  }
}
