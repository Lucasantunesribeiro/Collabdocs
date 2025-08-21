import NextAuth, { NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import { DefaultSession } from "next-auth"

// Types are declared in src/types/next-auth.d.ts

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Primeiro login - adicionar informações do provedor
      if (account && user) {
        console.log('[NextAuth] JWT Callback - First login:', {
          provider: account.provider,
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        })
        
        token.provider = account.provider as 'github' | 'google'
        token.accessToken = account.access_token || ''
        
        // Garantir que temos os dados essenciais
        token.name = user.name || profile?.name || ''
        token.email = user.email || profile?.email || ''
        token.picture = user.image || profile?.image || ''
      }
      
      return token
    },
    
    async session({ session, token }) {
      // Transferir dados do token para a sessão
      if (token && session.user) {
        session.user.id = token.sub as string
        session.user.name = token.name as string
        session.user.email = token.email as string
        session.user.image = token.picture as string
        session.user.provider = token.provider as 'github' | 'google'
        session.accessToken = token.accessToken as string
        
        console.log('[NextAuth] Session Callback - User authenticated:', {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          provider: session.user.provider
        })
      }
      
      return session
    },
    
    async signIn({ user, account, profile, email, credentials }) {
      // Log detalhado do login
      console.log('[NextAuth] SignIn Callback:', {
        provider: account?.provider,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        profile: profile ? {
          name: profile.name,
          email: profile.email
        } : null
      })
      
      // Validar se temos email válido
      if (!user.email || !user.email.includes('@')) {
        console.error('[NextAuth] SignIn blocked - Invalid email:', user.email)
        return false
      }
      
      return true
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('[NextAuth] User signed in:', {
        userId: user.id,
        name: user.name,
        email: user.email,
        provider: account?.provider,
        isNewUser
      })
    },
    async signOut({ session, token }) {
      console.log('[NextAuth] User signed out:', {
        userId: session?.user?.id || token?.sub,
        email: session?.user?.email || token?.email
      })
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
