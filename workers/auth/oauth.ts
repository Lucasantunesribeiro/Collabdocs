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

export async function handleAuth(request: Request, env: Env): Promise<Response> {
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
        'GET /auth/logout - Logout',
        'GET /auth/oauth - Este endpoint (info)'
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
  
  // Endpoint específico para /auth/oauth
  if (path === '/oauth') {
    return new Response(JSON.stringify({ 
      message: 'CollabDocs OAuth Service',
      version: '1.0.0',
      status: 'running',
      endpoints: [
        'GET /auth/github - Login com GitHub',
        'GET /auth/google - Login com Google',
        'GET /auth/logout - Logout',
        'GET /auth/oauth - Este endpoint (info)'
      ],
      note: 'Este é o endpoint específico para /auth/oauth'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Auth endpoint not found' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

function handleGitHubLogin(env: Env): Response {
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('scope', 'user:email');
  githubAuthUrl.searchParams.set('redirect_uri', `${getBaseUrl(env)}/auth/github/callback`);
  githubAuthUrl.searchParams.set('state', crypto.randomUUID());

  return Response.redirect(githubAuthUrl.toString(), 302);
}

async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response('Authorization code not found', { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
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

    const githubUser = await userResponse.json() as GitHubUser;

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

    // Create or update user
    const user = await createOrUpdateUser(env, {
      provider: 'github',
      provider_id: githubUser.id.toString(),
      email,
      name: githubUser.name || githubUser.login,
      avatar_url: githubUser.avatar_url,
    });

    // Create JWT
    const jwt = await createJWT(user, env);

    // Redirect to frontend with token
    const frontendUrl = new URL(env.FRONTEND_URL || 'http://localhost:3000');
    frontendUrl.searchParams.set('token', jwt);
    
    return Response.redirect(frontendUrl.toString(), 302);

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
}

function handleGoogleLogin(env: Env): Response {
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', `${getBaseUrl(env)}/auth/google/callback`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid profile email');
  googleAuthUrl.searchParams.set('state', crypto.randomUUID());

  return Response.redirect(googleAuthUrl.toString(), 302);
}

async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Authorization code not found', { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${getBaseUrl(env)}/auth/google/callback`,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token: string };
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`);
    const googleUser = await userResponse.json() as GoogleUser;

    // Create or update user
    const user = await createOrUpdateUser(env, {
      provider: 'google',
      provider_id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture,
    });

    // Create JWT
    const jwt = await createJWT(user, env);

    // Redirect to frontend with token
    const frontendUrl = new URL(env.FRONTEND_URL || 'http://localhost:3000');
    frontendUrl.searchParams.set('token', jwt);
    
    return Response.redirect(frontendUrl.toString(), 302);

  } catch (error) {
    console.error('Google OAuth error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
}

function handleLogout(): Response {
  return new Response(JSON.stringify({ message: 'Logged out' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict',
    },
  });
}

async function createOrUpdateUser(env: Env, userData: {
  provider: 'github' | 'google';
  provider_id: string;
  email: string;
  name: string;
  avatar_url: string;
}): Promise<User> {
  const userId = `${userData.provider}:${userData.provider_id}`;
  const now = new Date().toISOString();

  try {
    // Try to update existing user first
    const existingUser = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(userId).first();

    if (existingUser) {
      // Update existing user
      await env.DB.prepare(`
        UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?
      `).bind(userData.email, userData.name, userData.avatar_url, userId).run();
    } else {
      // Create new user
      await env.DB.prepare(`
        INSERT INTO users (id, email, name, avatar_url, provider, provider_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        userData.email,
        userData.name,
        userData.avatar_url,
        userData.provider,
        userData.provider_id,
        now
      ).run();
    }

    return {
      id: userId,
      email: userData.email,
      name: userData.name,
      avatar_url: userData.avatar_url,
      provider: userData.provider,
      provider_id: userData.provider_id,
      created_at: existingUser?.created_at || now,
    };
  } catch (error) {
    console.error('Database error:', error);
    // Fallback: return user data without database persistence
    return {
      id: userId,
      email: userData.email,
      name: userData.name,
      avatar_url: userData.avatar_url,
      provider: userData.provider,
      provider_id: userData.provider_id,
      created_at: now,
    };
  }
}

async function createJWT(user: User, env: Env): Promise<string> {
  // Para MVP, vamos usar uma abordagem simplificada
  // Em produção, usar uma biblioteca JWT compatível com Workers
  
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    provider: user.provider,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  // Encode payload as base64
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);
  
  // Create a simple token (not cryptographically secure for MVP)
  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payloadB64}.${env.JWT_SECRET || 'demo-secret'}`;
  
  return token;
}

function getBaseUrl(env: Env): string {
  return env.FRONTEND_URL?.replace(/\/+$/, '') || 'https://collab-docs.collabdocs.workers.dev';
}