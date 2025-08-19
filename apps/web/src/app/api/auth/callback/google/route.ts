import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      console.error('Google callback: No code provided')
      return NextResponse.redirect('/?error=no_code')
    }
    
    console.log('Google callback: Processing code:', code)
    
    // Verificar se as variáveis de ambiente estão configuradas
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google callback: Missing environment variables')
      return NextResponse.redirect('/?error=config_error')
    }
    
    // Trocar o código por um token de acesso
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
        redirect_uri: process.env.NEXTAUTH_URL + '/api/auth/callback/google',
      }),
    })
    
    if (!tokenResponse.ok) {
      console.error('Google token request failed:', tokenResponse.status)
      const errorText = await tokenResponse.text()
      console.error('Google token error response:', errorText)
      return NextResponse.redirect('/?error=token_request_failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('Google token response:', tokenData)
    
    if (tokenData.access_token) {
      // Obter informações do usuário
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })
      
      if (!userResponse.ok) {
        console.error('Google user request failed:', userResponse.status)
        return NextResponse.redirect('/?error=user_request_failed')
      }
      
      const userData = await userResponse.json()
      console.log('Google user data:', userData)
      
      // Criar um token JWT simples
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar_url: userData.picture,
        provider: 'google',
      }
      
      // Redirecionar para a página principal com os dados do usuário
      const redirectUrl = `/?user=${encodeURIComponent(JSON.stringify(user))}`
      console.log('Google callback: Redirecting to:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    } else {
      console.error('Google callback: No access token in response')
      return NextResponse.redirect('/?error=token_failed')
    }
  } catch (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect('/?error=oauth_failed')
  }
}
