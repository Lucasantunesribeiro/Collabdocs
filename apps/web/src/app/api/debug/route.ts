import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verificar variáveis de ambiente
    const envCheck = {
      GITHUB_CLIENT_ID: !!process.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: !!process.env.GITHUB_CLIENT_SECRET,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    }
    
    // Testar conexão com GitHub
    let githubTest = null
    try {
      const testResponse = await fetch('https://api.github.com/rate_limit', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      })
      githubTest = {
        status: testResponse.status,
        ok: testResponse.ok,
        limit: testResponse.headers.get('x-ratelimit-limit'),
        remaining: testResponse.headers.get('x-ratelimit-remaining'),
      }
    } catch (error) {
      githubTest = { error: error instanceof Error ? error.message : String(error) }
    }
    
    // Testar conexão com Google
    let googleTest = null
    try {
      const testResponse = await fetch('https://www.googleapis.com/discovery/v1/apis')
      googleTest = {
        status: testResponse.status,
        ok: testResponse.ok,
      }
    } catch (error) {
      googleTest = { error: error instanceof Error ? error.message : String(error) }
    }
    
    // Verificar configurações do Google OAuth
    const googleOAuthConfig = {
      clientId: !!process.env.GOOGLE_CLIENT_ID,
      clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      redirectUri: process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google` : null,
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      envCheck,
      githubTest,
      googleTest,
      googleOAuthConfig,
      message: 'Debug endpoint working',
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
