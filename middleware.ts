import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Logs para debug
    console.log('[Middleware] Request:', {
      url: req.url,
      pathname: req.nextUrl.pathname,
      user: req.nextauth.token ? {
        id: req.nextauth.token.sub,
        email: req.nextauth.token.email,
        name: req.nextauth.token.name,
        provider: req.nextauth.token.provider
      } : null
    })

    // Permitir acesso às rotas de autenticação
    if (req.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.next()
    }

    // Permitir acesso à API do NextAuth
    if (req.nextUrl.pathname.startsWith('/api/auth/')) {
      return NextResponse.next()
    }

    // Verificar autenticação para rotas protegidas
    if (!req.nextauth.token) {
      console.log('[Middleware] Redirecting unauthenticated user to signin')
      
      // Redirecionar para login mantendo a URL de destino
      const signInUrl = new URL('/auth/signin', req.url)
      signInUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(signInUrl)
    }

    // Verificar se o token tem dados essenciais
    if (!req.nextauth.token.email || !req.nextauth.token.name) {
      console.error('[Middleware] Invalid token - missing user data:', {
        hasEmail: !!req.nextauth.token.email,
        hasName: !!req.nextauth.token.name
      })
      
      // Forçar novo login
      const signInUrl = new URL('/auth/signin', req.url)
      signInUrl.searchParams.set('error', 'InvalidSession')
      return NextResponse.redirect(signInUrl)
    }

    // Log de acesso autorizado
    console.log('[Middleware] Access granted:', {
      user: req.nextauth.token.email,
      path: req.nextUrl.pathname
    })

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permitir acesso se temos token válido
        return !!token
      }
    }
  }
)

// Configurar quais rotas devem ser protegidas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public|auth/signin|auth/error).*)',
  ],
}