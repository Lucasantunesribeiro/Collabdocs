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
  // Para MVP, vamos retornar um erro informando que OAuth está em desenvolvimento
  return new Response(JSON.stringify({ 
    error: 'OAuth em desenvolvimento',
    message: 'GitHub OAuth será implementado em breve. Use o Modo Demo por enquanto.',
    status: 'development'
  }), { 
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  // Para MVP, vamos retornar um erro informando que OAuth está em desenvolvimento
  return new Response(JSON.stringify({ 
    error: 'OAuth em desenvolvimento',
    message: 'GitHub OAuth será implementado em breve. Use o Modo Demo por enquanto.',
    status: 'development'
  }), { 
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

function handleGoogleLogin(env: Env): Response {
  // Para MVP, vamos retornar um erro informando que OAuth está em desenvolvimento
  return new Response(JSON.stringify({ 
    error: 'OAuth em desenvolvimento',
    message: 'Google OAuth será implementado em breve. Use o Modo Demo por enquanto.',
    status: 'development'
  }), { 
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  // Para MVP, vamos retornar um erro informando que OAuth está em desenvolvimento
  return new Response(JSON.stringify({ 
    error: 'OAuth em desenvolvimento',
    message: 'Google OAuth será implementado em breve. Use o Modo Demo por enquanto.',
    status: 'development'
  }), { 
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
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

// Funções auxiliares simplificadas para MVP
async function createOrUpdateUser(env: Env, userData: {
  provider: 'github' | 'google';
  provider_id: string;
  email: string;
  name: string;
  avatar_url: string;
}): Promise<User> {
  // Para MVP, retornar usuário mock
  return {
    id: `${userData.provider}:${userData.provider_id}`,
    email: userData.email,
    name: userData.name,
    avatar_url: userData.avatar_url,
    provider: userData.provider,
    provider_id: userData.provider_id,
    created_at: new Date().toISOString(),
  };
}

async function createJWT(user: User, env: Env): Promise<string> {
  // Para MVP, retornar token mock
  return `mock-jwt-token-${user.id}-${Date.now()}`;
}

function getBaseUrl(env: Env): string {
  return env.FRONTEND_URL?.replace(/\/+$/, '') || 'https://collab-docs.collabdocs.workers.dev';
}