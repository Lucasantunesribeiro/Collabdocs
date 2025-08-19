import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      console.error('GitHub callback: No code provided')
      return NextResponse.redirect('/?error=no_code')
    }
    
    console.log('GitHub callback: Processing code:', code)
    
    // Verificar se as variáveis de ambiente estão configuradas
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      console.error('GitHub callback: Missing environment variables')
      return NextResponse.redirect('/?error=config_error')
    }
    
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
    
    if (!tokenResponse.ok) {
      console.error('GitHub token request failed:', tokenResponse.status)
      return NextResponse.redirect('/?error=token_request_failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('GitHub token response:', tokenData)
    
    if (tokenData.access_token) {
      // Obter informações do usuário
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })
      
      if (!userResponse.ok) {
        console.error('GitHub user request failed:', userResponse.status)
        return NextResponse.redirect('/?error=user_request_failed')
      }
      
      const userData = await userResponse.json()
      console.log('GitHub user data:', userData)
      
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
      console.log('GitHub callback: Redirecting to:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    } else {
      console.error('GitHub callback: No access token in response')
      return NextResponse.redirect('/?error=token_failed')
    }
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect('/?error=oauth_failed')
  }
}
