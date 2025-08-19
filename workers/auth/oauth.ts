import { User, JWTPayload } from '@collab-docs/shared';
import { Env } from '../index';

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export async function handleAuth(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/auth', '');

  // Endpoint raiz para auth
  if (path === '' || path === '/') {
    return new Response(JSON.stringify({ 
      message: 'CollabDocs Authentication Service',
      version: '1.0.0',
      status: 'running',
      endpoints: [
        'GET /auth/github - Login com GitHub',
        'GET /auth/google - Login com Google',
        'GET /auth/logout - Logout'
      ]
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/github') {
    return handleGitHubLogin(env);
  }
  
  if (path === '/github/callback') {
    return handleGitHubCallback(request, env);
  }
  
  if (path === '/google') {
    return handleGoogleLogin(env);
  }
  
  if (path === '/google/callback') {
    return handleGoogleCallback(request, env);
  }
  
  if (path === '/logout') {
    return handleLogout();
  }

  return new Response(JSON.stringify({ error: 'Auth endpoint not found' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

function handleGitHubLogin(env: any): Response {
  try {
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID || '');
    githubAuthUrl.searchParams.set('scope', 'user:email');
    githubAuthUrl.searchParams.set('redirect_uri', 'https://collab-docs.collabdocs.workers.dev/auth/github/callback');
    githubAuthUrl.searchParams.set('state', 'demo-state');

    // Em vez de redirect, retornar a URL para o frontend
    return new Response(JSON.stringify({ 
      success: true,
      auth_url: githubAuthUrl.toString(),
      message: 'GitHub OAuth URL criada com sucesso'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('GitHub login error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create GitHub OAuth URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGitHubCallback(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return new Response('Authorization code not found', { status: 400 });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID || '',
        client_secret: env.GITHUB_CLIENT_SECRET || '',
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token: string };
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CollabDocs/1.0',
      },
    });

    const githubUser = await userResponse.json() as any;

    // Get primary email if not public
    let email = githubUser.email;
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CollabDocs/1.0',
        },
      });
      
      const emails = await emailResponse.json() as Array<{ email: string; primary: boolean }>;
      const primaryEmail = emails.find(e => e.primary);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) {
      throw new Error('No email found for GitHub user');
    }

    // Create user data
    const user = {
      id: `github:${githubUser.id}`,
      email,
      name: githubUser.name || githubUser.login,
      avatar_url: githubUser.avatar_url,
      provider: 'github',
      provider_id: githubUser.id.toString(),
      created_at: new Date().toISOString(),
    };

    // Create simple JWT
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      provider: user.provider,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = btoa(payloadStr);
    const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payloadB64}.${env.JWT_SECRET || 'demo-secret'}`;

    // Redirect to frontend with token
    const frontendUrl = new URL(env.FRONTEND_URL || 'http://localhost:3000');
    frontendUrl.searchParams.set('token', jwt);
    frontendUrl.searchParams.set('user', JSON.stringify(user));
    
    // Use HTML redirect instead of Response.redirect to avoid Worker error
    const htmlRedirect = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Autenticação Realizada</title>
      <meta charset="utf-8">
    </head>
    <body>
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>✅ Autenticação realizada com sucesso!</h2>
        <p>Redirecionando para o CollabDocs...</p>
        <script>
          window.location.href = "${frontendUrl.toString()}";
        </script>
      </div>
    </body>
    </html>
    `;
    
    return new Response(htmlRedirect, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return new Response(JSON.stringify({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function handleGoogleLogin(env: any): Response {
  try {
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID || '');
    googleAuthUrl.searchParams.set('redirect_uri', 'https://collab-docs.collabdocs.workers.dev/auth/google/callback');
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid profile email');
    googleAuthUrl.searchParams.set('state', 'demo-state');

    // Em vez de redirect, retornar a URL para o frontend
    return new Response(JSON.stringify({ 
      success: true,
      auth_url: googleAuthUrl.toString(),
      message: 'Google OAuth URL criada com sucesso'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Google login error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create Google OAuth URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGoogleCallback(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return new Response('Authorization code not found', { status: 400 });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID || '',
        client_secret: env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://collab-docs.collabdocs.workers.dev/auth/google/callback',
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token: string };
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`);
    const googleUser = await userResponse.json() as any;

    // Create user data
    const user = {
      id: `google:${googleUser.id}`,
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture,
      provider: 'google',
      provider_id: googleUser.id,
      created_at: new Date().toISOString(),
    };

    // Create simple JWT
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      provider: user.provider,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = btoa(payloadStr);
    const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payloadB64}.${env.JWT_SECRET || 'demo-secret'}`;

    // Redirect to frontend with token
    const frontendUrl = new URL(env.FRONTEND_URL || 'http://localhost:3000');
    frontendUrl.searchParams.set('token', jwt);
    frontendUrl.searchParams.set('user', JSON.stringify(user));
    
    // Use HTML redirect instead of Response.redirect to avoid Worker error
    const htmlRedirect = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Autenticação Realizada</title>
      <meta charset="utf-8">
    </head>
    <body>
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>✅ Autenticação realizada com sucesso!</h2>
        <p>Redirecionando para o CollabDocs...</p>
        <script>
          window.location.href = "${frontendUrl.toString()}";
        </script>
      </div>
    </body>
    </html>
    `;
    
    return new Response(htmlRedirect, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    return new Response(JSON.stringify({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function handleLogout(): Response {
  return new Response(JSON.stringify({ message: 'Logged out' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}