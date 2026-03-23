import type { Env } from '../index';
import { verifyToken } from '../middleware/auth';
import { corsResponse, getCORSHeaders } from '../middleware/cors';
import {
  listDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../application/documents';
import {
  listCollaborators,
  addCollaborator,
  removeCollaborator,
} from '../application/collaborators';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(
  data: unknown,
  status: number,
  req: Request,
  env: Env
): Response {
  return corsResponse(
    status,
    JSON.stringify(data),
    req,
    env.ALLOWED_ORIGINS ?? '',
    { 'Content-Type': 'application/json' }
  );
}

function errorResponse(
  message: string,
  status: number,
  req: Request,
  env: Env
): Response {
  return json({ error: message }, status, req, env);
}

async function authenticate(req: Request, env: Env) {
  const user = await verifyToken(req, env.NEXTAUTH_SECRET);
  return user;
}

function getStatusFromError(err: unknown): number {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as any).status as number;
  }
  return 500;
}

function getMessageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Internal server error';
}

// ---------------------------------------------------------------------------
// Request logger middleware — called from router after response is produced
// ---------------------------------------------------------------------------

export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  logger.info('http_request', { method, path, status, durationMs });
}

// ---------------------------------------------------------------------------
// Document handlers
// ---------------------------------------------------------------------------

export async function handleListDocuments(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  try {
    const docs = await listDocuments(env.DB, user);
    return json({ documents: docs, count: docs.length }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    logger.error('listDocuments failed', err, { status });
    return errorResponse(message, status, req, env);
  }
}

export async function handleCreateDocument(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, req, env);
  }

  const { title, content, visibility } = body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return errorResponse('title is required', 400, req, env);
  }

  try {
    const doc = await createDocument(env.DB, user, { title, content, visibility });
    return json({ document: doc, message: 'Document created' }, 201, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    logger.error('createDocument failed', err, { status });
    return errorResponse(message, status, req, env);
  }
}

export async function handleGetDocument(
  req: Request,
  env: Env,
  id: string
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  try {
    const result = await getDocumentById(env.DB, user, id);
    return json(result, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    logger.error('getDocument failed', err, { documentId: id });
    return errorResponse('Failed to retrieve document', 500, req, env);
  }
}

export async function handleUpdateDocument(
  req: Request,
  env: Env,
  id: string
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, req, env);
  }

  const { content, title, expectedVersion } = body ?? {};

  if (content === undefined && title === undefined) {
    return errorResponse('Provide at least one field to update: content or title', 400, req, env);
  }

  try {
    const result = await updateDocument(env.DB, user, id, { content, title, expectedVersion });
    return json({ ...result, message: 'Document updated' }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    logger.error('updateDocument failed', err, { documentId: id });
    return errorResponse('Failed to update document', 500, req, env);
  }
}

export async function handleDeleteDocument(
  req: Request,
  env: Env,
  id: string
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  try {
    const result = await deleteDocument(env.DB, user, id);
    return json({ message: 'Document deleted', ...result }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    logger.error('deleteDocument failed', err, { documentId: id });
    return errorResponse('Failed to delete document', 500, req, env);
  }
}

// ---------------------------------------------------------------------------
// Collaborator handlers
// ---------------------------------------------------------------------------

export async function handleGetCollaborators(
  req: Request,
  env: Env,
  id: string
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  try {
    const collaborators = await listCollaborators(env.DB, user, id);
    return json({ collaborators, document_id: id, total: collaborators.length }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    logger.error('getCollaborators failed', err, { documentId: id });
    return errorResponse('Failed to retrieve collaborators', 500, req, env);
  }
}

export async function handleAddCollaborator(
  req: Request,
  env: Env,
  id: string
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, req, env);
  }

  const { email, permission = 'read' } = body ?? {};

  if (!email || typeof email !== 'string') {
    return errorResponse('email is required', 400, req, env);
  }

  try {
    await addCollaborator(env.DB, user, id, email, permission, env.NOTIFICATION_QUEUE);
    return json({ message: 'Collaborator added', documentId: id, email, permission }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    logger.error('addCollaborator failed', err, { documentId: id });
    return errorResponse('Failed to add collaborator', 500, req, env);
  }
}

export async function handleRemoveCollaborator(
  req: Request,
  env: Env,
  id: string
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return errorResponse('Authentication required', 401, req, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, req, env);
  }

  const { email } = body ?? {};

  if (!email || typeof email !== 'string') {
    return errorResponse('email is required', 400, req, env);
  }

  try {
    await removeCollaborator(env.DB, user, id, email);
    return json({ message: 'Collaborator removed', documentId: id, email }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    logger.error('removeCollaborator failed', err, { documentId: id });
    return errorResponse('Failed to remove collaborator', 500, req, env);
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function handleHealthCheck(
  req: Request,
  env: Env
): Promise<Response> {
  const timestamp = new Date().toISOString();
  let dbStatus: { status: 'ok' | 'error'; message?: string };

  try {
    await env.DB.prepare('SELECT 1').first();
    dbStatus = { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Health check: database unreachable', { error: message });
    dbStatus = { status: 'error', message };
  }

  const overallStatus = dbStatus.status === 'ok' ? 'healthy' : 'degraded';

  return json(
    {
      status: overallStatus,
      timestamp,
      version: '2.0.0',
      checks: {
        database: dbStatus,
      },
    },
    200,
    req,
    env
  );
}
