import { DocumentDurableObject } from './durable-objects/document';
import { handleAuth } from './auth/oauth';
import { handleAPI } from './api/routes';

export { DocumentDurableObject };

export interface Env {
  DOCUMENT_DO: DurableObjectNamespace;
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  CACHE: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers para development
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || 'http://localhost:3000',
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
      // Route WebSocket connections to Durable Objects
      if (url.pathname.startsWith('/ws/')) {
        const documentId = url.pathname.split('/')[2];
        if (!documentId) {
          response = new Response('Document ID required', { status: 400 });
        } else {
          const id = env.DOCUMENT_DO.idFromName(documentId);
          const stub = env.DOCUMENT_DO.get(id);
          response = await stub.fetch(request);
        }
      }
      // Route auth requests
      else if (url.pathname.startsWith('/auth/')) {
        response = await handleAuth(request, env);
      }
      // Route API requests
      else if (url.pathname.startsWith('/api/')) {
        response = await handleAPI(request, env);
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