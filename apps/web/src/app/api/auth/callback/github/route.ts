import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 GitHub callback iniciado')
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    console.log('📝 GitHub callback - code recebido:', code ? 'SIM' : 'NÃO')
    
    if (!code) {
      console.error('❌ GitHub callback: No code provided')
      return NextResponse.redirect('https://collabdocs-app.vercel.app/?error=no_code')
    }
    
    // Verificar variáveis de ambiente
    console.log('🔑 GitHub callback - Verificando variáveis de ambiente...')
    console.log('   GITHUB_CLIENT_ID:', !!process.env.GITHUB_CLIENT_ID)
    console.log('   GITHUB_CLIENT_SECRET:', !!process.env.GITHUB_CLIENT_SECRET)
    
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      console.error('❌ GitHub callback: Missing environment variables')
      return NextResponse.redirect('https://collabdocs-app.vercel.app/?error=config_error')
    }
    
    console.log('✅ GitHub callback - Variáveis de ambiente OK')
    
    // Trocar o código por um token de acesso
    console.log('🔄 GitHub callback - Trocando código por token...')
    
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
    
    console.log('📡 GitHub callback - Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ GitHub callback - Token request failed:', tokenResponse.status, errorText)
      return NextResponse.redirect('https://collabdocs-app.vercel.app/?error=token_request_failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ GitHub callback - Token obtido com sucesso')
    
    if (tokenData.access_token) {
      console.log('👤 GitHub callback - Obtendo dados do usuário...')
      
      // Obter informações do usuário
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })
      
      console.log('📡 GitHub callback - User response status:', userResponse.status)
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text()
        console.error('❌ GitHub callback - User request failed:', userResponse.status, errorText)
        return NextResponse.redirect('https://collabdocs-app.vercel.app/?error=user_request_failed')
      }
      
      const userData = await userResponse.json()
      console.log('✅ GitHub callback - Dados do usuário obtidos:', userData.login)
      
      // Criar objeto do usuário
      const user = {
        id: userData.id.toString(),
        name: userData.name || userData.login,
        email: userData.email,
        avatar_url: userData.avatar_url,
        provider: 'github',
      }
      
      // Redirecionar para a página principal com os dados do usuário
      const redirectUrl = `https://collabdocs-app.vercel.app/?user=${encodeURIComponent(JSON.stringify(user))}`
      console.log('🚀 GitHub callback - Redirecionando para:', redirectUrl)
      
      return NextResponse.redirect(redirectUrl)
    } else {
      console.error('❌ GitHub callback - No access token in response:', tokenData)
      return NextResponse.redirect('https://collabdocs-app.vercel.app/?error=token_failed')
    }
  } catch (error) {
    console.error('💥 GitHub callback - Erro inesperado:', error)
    if (error instanceof Error) {
      console.error('   Stack:', error.stack)
    }
    return NextResponse.redirect('https://collabdocs-app.vercel.app/?error=oauth_failed')
  }
}
