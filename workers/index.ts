// import { DocumentDurableObject } from './durable-objects/document';
import { handleAuth } from './auth/oauth';
import { handleAPI } from './api/routes';

// export { DocumentDurableObject };

export interface Env {
  // DOCUMENT_DO: DurableObjectNamespace;
  DB: any; // D1Database temporariamente desabilitado
  // SNAPSHOTS: R2Bucket;
  CACHE: any; // KVNamespace temporariamente desabilitado
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers para aceitar múltiplos domínios
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://e9de5f65.collab-docs-frontend.pages.dev',
      'https://1312114f.collab-docs-frontend.pages.dev',
      'https://2cec1a20.collab-docs-frontend.pages.dev',
      'https://1aa6de9a.collab-docs-frontend.pages.dev',
    ];
    
    const origin = request.headers.get('Origin');
    let corsOrigin = 'http://localhost:3000'; // default
    
    if (origin) {
      // Verificar se o origin está na lista de permitidos
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          return origin.includes(allowed.replace('*', ''));
        }
        return origin === allowed;
      });
      
      // Aceitar automaticamente qualquer domínio da Vercel
      const isVercelDomain = origin.includes('vercel.app');
      
      if (isAllowed || isVercelDomain) {
        corsOrigin = origin;
      }
    }
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    let response: Response;

    try {
      // Route WebSocket connections to Durable Objects (temporarily disabled)
      if (url.pathname.startsWith('/ws/')) {
        response = new Response(JSON.stringify({ 
          error: 'WebSocket functionality temporarily disabled',
          message: 'Durable Objects not available on free plan'
        }), { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Route auth requests
      else if (url.pathname.startsWith('/auth')) {
        response = await handleAuth(request, env);
      }
      // Route API requests
      else if (url.pathname.startsWith('/api')) {
        response = await handleAPI(request, env);
      }
      // Favicon endpoint
      else if (url.pathname === '/favicon.ico') {
        response = new Response(null, { status: 204 });
      }
      // Health check
      else if (url.pathname === '/health') {
        response = new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString() 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Default response
      else {
        response = new Response(JSON.stringify({ 
          error: 'Not Found',
          message: 'CollabDocs API - Use /api/ for REST endpoints or /ws/ for WebSocket'
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      response = new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add CORS headers to all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  },
};