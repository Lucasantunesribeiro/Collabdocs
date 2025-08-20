import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  
  if (provider === 'github') {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + '/api/auth/callback/github')}&scope=user:email`
    return NextResponse.redirect(githubAuthUrl)
  }
  
  if (provider === 'google') {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + '/api/auth/callback/google')}&scope=openid email profile&response_type=code`
    return NextResponse.redirect(googleAuthUrl)
  }
  
  return NextResponse.json({ error: 'Provider not specified' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Auth endpoint working' })
}
