import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.redirect('/?error=no_code')
  }
  
  try {
    // Trocar o código por um token de acesso
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    })
    
    const tokenData = await tokenResponse.json()
    
    if (tokenData.access_token) {
      // Obter informações do usuário
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })
      
      const userData = await userResponse.json()
      
      // Criar um token JWT simples
      const user = {
        id: userData.id.toString(),
        name: userData.name || userData.login,
        email: userData.email,
        avatar_url: userData.avatar_url,
        provider: 'github',
      }
      
      // Redirecionar para a página principal com os dados do usuário
      const redirectUrl = `/?user=${encodeURIComponent(JSON.stringify(user))}`
      return NextResponse.redirect(redirectUrl)
    } else {
      return NextResponse.redirect('/?error=token_failed')
    }
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect('/?error=oauth_failed')
  }
}
