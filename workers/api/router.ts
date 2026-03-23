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
  logRequest,
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
    const startMs = Date.now();

    // Helper that emits the request log after every handler resolves
    async function timed(handlerPromise: Promise<Response>): Promise<Response> {
      const response = await handlerPromise;
      logRequest(method, path, response.status, Date.now() - startMs);
      return response;
    }

    // CORS preflight — always allow, even before rate limit
    if (method === 'OPTIONS') {
      const res = corsResponse(204, null, request, env.ALLOWED_ORIGINS ?? '');
      logRequest(method, path, res.status, Date.now() - startMs);
      return res;
    }

    // Rate limiting on public API paths (fail-open)
    if (path.startsWith('/api/')) {
      try {
        const allowed = await checkRateLimit(env, request);
        if (!allowed) {
          return timed(Promise.resolve(rateLimitExceeded(request, env)));
        }
      } catch {
        // Fail-open: DB unavailable
      }
    }

    // Root path
    if (path === '/') {
      const res = corsResponse(
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
      logRequest(method, path, res.status, Date.now() - startMs);
      return res;
    }

    // /api/health
    if (path === '/api/health' && method === 'GET') {
      return timed(handleHealthCheck(request, env));
    }

    // /api/documents
    if (path === '/api/documents') {
      if (method === 'GET') return timed(handleListDocuments(request, env));
      if (method === 'POST') return timed(handleCreateDocument(request, env));
      return timed(Promise.resolve(methodNotAllowed(request, env)));
    }

    // /api/documents/:id/collaborators
    const collabMatch = path.match(/^\/api\/documents\/([^/]+)\/collaborators$/);
    if (collabMatch) {
      const id = collabMatch[1];
      if (!isValidUUID(id)) {
        return timed(
          Promise.resolve(
            corsResponse(
              400,
              JSON.stringify({ error: 'Invalid document ID format' }),
              request,
              env.ALLOWED_ORIGINS ?? '',
              { 'Content-Type': 'application/json' }
            )
          )
        );
      }
      if (method === 'GET') return timed(handleGetCollaborators(request, env, id));
      if (method === 'POST') return timed(handleAddCollaborator(request, env, id));
      if (method === 'DELETE') return timed(handleRemoveCollaborator(request, env, id));
      return timed(Promise.resolve(methodNotAllowed(request, env)));
    }

    // /api/documents/:id/ws — WebSocket upgrade for real-time collaboration
    const wsMatch = path.match(/^\/api\/documents\/([^/]+)\/ws$/);
    if (wsMatch && method === 'GET') {
      const documentId = wsMatch[1];
      if (!isValidUUID(documentId)) {
        return timed(
          Promise.resolve(
            corsResponse(
              400,
              JSON.stringify({ error: 'Invalid document ID format' }),
              request,
              env.ALLOWED_ORIGINS ?? '',
              { 'Content-Type': 'application/json' }
            )
          )
        );
      }

      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return timed(
          Promise.resolve(
            corsResponse(
              426,
              JSON.stringify({ error: 'Expected WebSocket upgrade' }),
              request,
              env.ALLOWED_ORIGINS ?? '',
              { 'Content-Type': 'application/json' }
            )
          )
        );
      }

      // Route to the Durable Object for this document session
      const id = env.COLLAB_SESSIONS.idFromName(documentId);
      const session = env.COLLAB_SESSIONS.get(id);
      return session.fetch(request);
    }

    // /api/documents/:id
    const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch) {
      const id = docMatch[1];
      if (!isValidUUID(id)) {
        return timed(
          Promise.resolve(
            corsResponse(
              400,
              JSON.stringify({ error: 'Invalid document ID format' }),
              request,
              env.ALLOWED_ORIGINS ?? '',
              { 'Content-Type': 'application/json' }
            )
          )
        );
      }
      if (method === 'GET') return timed(handleGetDocument(request, env, id));
      if (method === 'PUT') return timed(handleUpdateDocument(request, env, id));
      if (method === 'DELETE') return timed(handleDeleteDocument(request, env, id));
      return timed(Promise.resolve(methodNotAllowed(request, env)));
    }

    return timed(Promise.resolve(notFound(request, env)));
  },
};
