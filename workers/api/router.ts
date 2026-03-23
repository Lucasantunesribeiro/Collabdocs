import type { Env } from '../index';
import { corsResponse, getCORSHeaders } from '../middleware/cors';
import { checkRateLimit } from '../middleware/rateLimit';
import {
  handleListDocuments,
  handleCreateDocument,
  handleGetDocument,
  handleUpdateDocument,
  handleDeleteDocument,
  handleGetCollaborators,
  handleAddCollaborator,
  handleRemoveCollaborator,
  handleHealthCheck,
} from './handlers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function notFound(req: Request, env: Env): Response {
  return corsResponse(
    404,
    JSON.stringify({ error: 'Not Found' }),
    req,
    env.ALLOWED_ORIGINS ?? '',
    { 'Content-Type': 'application/json' }
  );
}

function methodNotAllowed(req: Request, env: Env): Response {
  return corsResponse(
    405,
    JSON.stringify({ error: 'Method Not Allowed' }),
    req,
    env.ALLOWED_ORIGINS ?? '',
    { 'Content-Type': 'application/json' }
  );
}

function rateLimitExceeded(req: Request, env: Env): Response {
  return corsResponse(
    429,
    JSON.stringify({ error: 'Too Many Requests' }),
    req,
    env.ALLOWED_ORIGINS ?? '',
    { 'Content-Type': 'application/json', 'Retry-After': '60' }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight — always allow, even before rate limit
    if (method === 'OPTIONS') {
      return corsResponse(204, null, request, env.ALLOWED_ORIGINS ?? '');
    }

    // Rate limiting on public API paths (fail-open)
    if (path.startsWith('/api/')) {
      try {
        const allowed = await checkRateLimit(env.DB, request);
        if (!allowed) {
          return rateLimitExceeded(request, env);
        }
      } catch {
        // Fail-open: DB unavailable
      }
    }

    // Root path
    if (path === '/') {
      return corsResponse(
        200,
        JSON.stringify({
          app: 'CollabDocs API',
          version: '2.0.0',
          status: 'online',
          timestamp: new Date().toISOString(),
          endpoints: {
            documents: '/api/documents',
            health: '/api/health',
          },
          frontend: 'https://collabdocs-app.vercel.app',
        }),
        request,
        env.ALLOWED_ORIGINS ?? '',
        { 'Content-Type': 'application/json' }
      );
    }

    // /api/health
    if (path === '/api/health' && method === 'GET') {
      return handleHealthCheck(request, env);
    }

    // /api/documents
    if (path === '/api/documents') {
      if (method === 'GET') return handleListDocuments(request, env);
      if (method === 'POST') return handleCreateDocument(request, env);
      return methodNotAllowed(request, env);
    }

    // /api/documents/:id/collaborators
    const collabMatch = path.match(/^\/api\/documents\/([^/]+)\/collaborators$/);
    if (collabMatch) {
      const id = collabMatch[1];
      if (!isValidUUID(id)) {
        return corsResponse(
          400,
          JSON.stringify({ error: 'Invalid document ID format' }),
          request,
          env.ALLOWED_ORIGINS ?? '',
          { 'Content-Type': 'application/json' }
        );
      }
      if (method === 'GET') return handleGetCollaborators(request, env, id);
      if (method === 'POST') return handleAddCollaborator(request, env, id);
      if (method === 'DELETE') return handleRemoveCollaborator(request, env, id);
      return methodNotAllowed(request, env);
    }

    // /api/documents/:id
    const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch) {
      const id = docMatch[1];
      if (!isValidUUID(id)) {
        return corsResponse(
          400,
          JSON.stringify({ error: 'Invalid document ID format' }),
          request,
          env.ALLOWED_ORIGINS ?? '',
          { 'Content-Type': 'application/json' }
        );
      }
      if (method === 'GET') return handleGetDocument(request, env, id);
      if (method === 'PUT') return handleUpdateDocument(request, env, id);
      if (method === 'DELETE') return handleDeleteDocument(request, env, id);
      return methodNotAllowed(request, env);
    }

    return notFound(request, env);
  },
};
