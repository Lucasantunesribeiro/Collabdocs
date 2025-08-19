import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.redirect('/?error=no_code')
  }
  
  try {
    // Trocar o código por um token de acesso
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.NEXTAUTH_URL + '/api/auth/callback/google',
      }),
    })
    
    const tokenData = await tokenResponse.json()
    
    if (tokenData.access_token) {
      // Obter informações do usuário
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })
      
      const userData = await userResponse.json()
      
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
      return NextResponse.redirect(redirectUrl)
    } else {
      return NextResponse.redirect('/?error=token_failed')
    }
  } catch (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect('/?error=oauth_failed')
  }
}
