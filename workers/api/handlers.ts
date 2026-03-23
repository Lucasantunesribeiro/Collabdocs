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
    console.error('[handlers] listDocuments error:', message);
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
    console.error('[handlers] createDocument error:', message);
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
    console.error('[handlers] getDocument error:', message);
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

  const { content, title } = body ?? {};

  if (content === undefined && title === undefined) {
    return errorResponse('Provide at least one field to update: content or title', 400, req, env);
  }

  try {
    const result = await updateDocument(env.DB, user, id, { content, title });
    return json({ ...result, message: 'Document updated' }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    console.error('[handlers] updateDocument error:', message);
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
    console.error('[handlers] deleteDocument error:', message);
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
    console.error('[handlers] getCollaborators error:', message);
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
    await addCollaborator(env.DB, user, id, email, permission);
    return json({ message: 'Collaborator added', documentId: id, email, permission }, 200, req, env);
  } catch (err) {
    const status = getStatusFromError(err);
    const message = getMessageFromError(err);
    if (status !== 500) {
      return errorResponse(message, status, req, env);
    }
    console.error('[handlers] addCollaborator error:', message);
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
    console.error('[handlers] removeCollaborator error:', message);
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
  return json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    },
    200,
    req,
    env
  );
}
