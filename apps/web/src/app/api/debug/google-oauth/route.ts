import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verificar configurações do Google OAuth
    const googleConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? '***' + process.env.GOOGLE_CLIENT_SECRET.slice(-4) : 'NÃO configurado',
      nextAuthUrl: process.env.NEXTAUTH_URL,
      redirectUri: 'https://collabdocs-app.vercel.app/api/auth/callback/google',
    }
    
    // Testar se as variáveis estão configuradas
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID
    const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET
    const hasNextAuthUrl = !!process.env.NEXTAUTH_URL
    
    // Verificar formato do Client ID (deve ser algo como: 123456789-abcdefghijklmnop.apps.googleusercontent.com)
    const clientIdFormat = process.env.GOOGLE_CLIENT_ID ? 
      (process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com') ? '✅ Formato correto' : '❌ Formato incorreto') : 
      'N/A'
    
    // Verificar se o Client Secret tem o formato correto (deve ter pelo menos 20 caracteres)
    const clientSecretFormat = process.env.GOOGLE_CLIENT_SECRET ? 
      (process.env.GOOGLE_CLIENT_SECRET.length >= 20 ? '✅ Formato correto' : '❌ Muito curto') : 
      'N/A'
    
    // Testar conexão com Google APIs
    let googleApiTest = null
    try {
      const testResponse = await fetch('https://www.googleapis.com/discovery/v1/apis')
      googleApiTest = {
        status: testResponse.status,
        ok: testResponse.ok,
        message: 'Conexão com Google APIs funcionando'
      }
    } catch (error) {
      googleApiTest = { 
        error: error instanceof Error ? error.message : String(error),
        message: 'Erro na conexão com Google APIs'
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      googleOAuthConfig: googleConfig,
      validation: {
        hasClientId,
        hasClientSecret,
        hasNextAuthUrl,
        clientIdFormat,
        clientSecretFormat,
        allConfigured: hasClientId && hasClientSecret && hasNextAuthUrl
      },
      googleApiTest,
      recommendations: [
        'Verifique se GOOGLE_CLIENT_ID está correto no Google Cloud Console',
        'Verifique se GOOGLE_CLIENT_SECRET está correto no Google Cloud Console',
        'Confirme se a URL de redirecionamento está configurada como: https://collabdocs-app.vercel.app/api/auth/callback/google',
        'Verifique se o projeto está ativo no Google Cloud Console',
        'Confirme se a API OAuth2 está habilitada'
      ]
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
