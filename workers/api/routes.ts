import { Document, Permission, JWTPayload } from '@collab-docs/shared';
import { Env } from '../index';

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const method = request.method;

  // Authenticate request (except for health checks)
  const authenticatedRequest = await authenticateRequest(request, env);
  if (!authenticatedRequest.user && !path.startsWith('/health')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Route API requests
    if (path === '/documents' && method === 'GET') {
      return await getDocuments(authenticatedRequest, env);
    }
    
    if (path === '/documents' && method === 'POST') {
      return await createDocument(authenticatedRequest, env);
    }
    
    if (path.startsWith('/documents/') && method === 'GET') {
      const documentId = path.split('/')[2];
      return await getDocument(authenticatedRequest, env, documentId);
    }
    
    if (path.startsWith('/documents/') && path.endsWith('/snapshot') && method === 'GET') {
      const documentId = path.split('/')[2];
      return await getDocumentSnapshot(authenticatedRequest, env, documentId);
    }
    
    if (path.startsWith('/documents/') && path.endsWith('/permissions') && method === 'POST') {
      const documentId = path.split('/')[2];
      return await updatePermissions(authenticatedRequest, env, documentId);
    }
    
    if (path.startsWith('/documents/') && path.endsWith('/history') && method === 'GET') {
      const documentId = path.split('/')[2];
      return await getDocumentHistory(authenticatedRequest, env, documentId);
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return request as AuthenticatedRequest;
  }

  const token = authorization.slice(7);
  const user = await verifyJWT(token, env);
  
  return Object.assign(request, { user }) as AuthenticatedRequest;
}

async function verifyJWT(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    // Simplified JWT verification - em produção usar biblioteca crypto completa
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    const signature = parts[2];
    
    // Check expiration
    if (payload.exp < Date.now() / 1000) return null;
    
    // TODO: Verificar assinatura com env.JWT_SECRET
    // Para MVP, apenas validamos estrutura e expiração
    
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

async function getDocuments(request: AuthenticatedRequest, env: Env): Promise<Response> {
  if (!request.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const result = await env.DB.prepare(`
    SELECT d.* FROM documents d
    LEFT JOIN permissions p ON d.id = p.document_id
    WHERE d.owner_id = ? OR p.user_id = ?
    ORDER BY d.updated_at DESC
  `).bind(request.user.sub, request.user.sub).all();

  return new Response(JSON.stringify({ documents: result.results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createDocument(request: AuthenticatedRequest, env: Env): Promise<Response> {
  if (!request.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json() as { title: string; visibility?: string };
  
  if (!body.title) {
    return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
  }

  const documentId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create document
  await env.DB.prepare(`
    INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    documentId,
    request.user.sub,
    body.title,
    body.visibility || 'private',
    now,
    now
  ).run();

  // Add owner permission
  await env.DB.prepare(`
    INSERT INTO permissions (document_id, user_id, role, granted_at)
    VALUES (?, ?, 'owner', ?)
  `).bind(documentId, request.user.sub, now).run();

  const document: Document = {
    id: documentId,
    owner_id: request.user.sub,
    title: body.title,
    visibility: body.visibility || 'private',
    created_at: now,
    updated_at: now,
  };

  return new Response(JSON.stringify({ document }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getDocument(request: AuthenticatedRequest, env: Env, documentId: string): Promise<Response> {
  if (!request.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check permissions
  const permission = await env.DB.prepare(`
    SELECT p.role FROM permissions p
    WHERE p.document_id = ? AND p.user_id = ?
    UNION
    SELECT 'owner' as role FROM documents d
    WHERE d.id = ? AND d.owner_id = ?
  `).bind(documentId, request.user.sub, documentId, request.user.sub).first();

  if (!permission) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const document = await env.DB.prepare(`
    SELECT * FROM documents WHERE id = ?
  `).bind(documentId).first();

  if (!document) {
    return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ 
    document,
    permission: permission.role 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getDocumentSnapshot(request: AuthenticatedRequest, env: Env, documentId: string): Promise<Response> {
  if (!request.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check permissions
  const hasAccess = await checkDocumentAccess(env, documentId, request.user.sub);
  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const document = await env.DB.prepare(`
    SELECT last_snapshot_r2_key FROM documents WHERE id = ?
  `).bind(documentId).first();

  if (!document?.last_snapshot_r2_key) {
    return new Response(JSON.stringify({ snapshot: null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get signed URL for R2 object
  const snapshot = await env.SNAPSHOTS.get(document.last_snapshot_r2_key);
  if (!snapshot) {
    return new Response(JSON.stringify({ error: 'Snapshot not found' }), { status: 404 });
  }

  const buffer = await snapshot.arrayBuffer();
  
  return new Response(buffer, {
    headers: { 
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip'
    }
  });
}

async function updatePermissions(request: AuthenticatedRequest, env: Env, documentId: string): Promise<Response> {
  if (!request.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if user is owner
  const document = await env.DB.prepare(`
    SELECT owner_id FROM documents WHERE id = ?
  `).bind(documentId).first();

  if (!document || document.owner_id !== request.user.sub) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const body = await request.json() as { user_id: string; role: string };
  
  if (!body.user_id || !['editor', 'viewer'].includes(body.role)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  // Upsert permission
  await env.DB.prepare(`
    INSERT INTO permissions (document_id, user_id, role, granted_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (document_id, user_id) 
    DO UPDATE SET role = excluded.role, granted_at = CURRENT_TIMESTAMP
  `).bind(documentId, body.user_id, body.role).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getDocumentHistory(request: AuthenticatedRequest, env: Env, documentId: string): Promise<Response> {
  if (!request.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const hasAccess = await checkDocumentAccess(env, documentId, request.user.sub);
  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const snapshots = await env.DB.prepare(`
    SELECT s.*, u.name as author_name 
    FROM snapshots s
    LEFT JOIN users u ON s.author_id = u.id
    WHERE s.document_id = ?
    ORDER BY s.created_at DESC
    LIMIT 50
  `).bind(documentId).all();

  return new Response(JSON.stringify({ snapshots: snapshots.results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function checkDocumentAccess(env: Env, documentId: string, userId: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT 1 FROM permissions p
    WHERE p.document_id = ? AND p.user_id = ?
    UNION
    SELECT 1 FROM documents d
    WHERE d.id = ? AND d.owner_id = ?
  `).bind(documentId, userId, documentId, userId).first();

  return !!result;
}