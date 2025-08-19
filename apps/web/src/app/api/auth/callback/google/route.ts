import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 Google callback iniciado')
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    console.log('📝 Google callback - code recebido:', code ? 'SIM' : 'NÃO')
    
    if (!code) {
      console.error('❌ Google callback: No code provided')
      return NextResponse.redirect('/?error=no_code')
    }
    
    // Verificar variáveis de ambiente
    console.log('🔑 Google callback - Verificando variáveis de ambiente...')
    console.log('   GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID)
    console.log('   GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET)
    console.log('   NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Google callback: Missing environment variables')
      return NextResponse.redirect('/?error=config_error')
    }
    
    console.log('✅ Google callback - Variáveis de ambiente OK')
    
    // Trocar o código por um token de acesso
    console.log('🔄 Google callback - Trocando código por token...')
    
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    console.log('   Redirect URI:', redirectUri)
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    
    console.log('📡 Google callback - Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Google callback - Token request failed:', tokenResponse.status, errorText)
      return NextResponse.redirect('/?error=token_request_failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ Google callback - Token obtido com sucesso')
    
    if (tokenData.access_token) {
      console.log('👤 Google callback - Obtendo dados do usuário...')
      
      // Obter informações do usuário
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })
      
      console.log('📡 Google callback - User response status:', userResponse.status)
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text()
        console.error('❌ Google callback - User request failed:', userResponse.status, errorText)
        return NextResponse.redirect('/?error=user_request_failed')
      }
      
      const userData = await userResponse.json()
      console.log('✅ Google callback - Dados do usuário obtidos:', userData.email)
      
      // Criar objeto do usuário
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar_url: userData.picture,
        provider: 'google',
      }
      
      // Redirecionar para a página principal com os dados do usuário
      const redirectUrl = `/?user=${encodeURIComponent(JSON.stringify(user))}`
      console.log('🚀 Google callback - Redirecionando para:', redirectUrl)
      
      return NextResponse.redirect(redirectUrl)
    } else {
      console.error('❌ Google callback - No access token in response:', tokenData)
      return NextResponse.redirect('/?error=token_failed')
    }
  } catch (error) {
    console.error('💥 Google callback - Erro inesperado:', error)
    if (error instanceof Error) {
      console.error('   Stack:', error.stack)
    }
    return NextResponse.redirect('/?error=oauth_failed')
  }
}
