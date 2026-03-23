import type { AuthenticatedUser, Document } from '../domain/types';
import {
  upsertUser,
  createDocumentRecord,
  findDocumentsByUser,
  findDocumentById,
  findUserById,
  findUsersByIds,
  updateDocumentRecord,
  deleteDocumentRecord,
  checkCollaboratorAccess,
} from '../infrastructure/db';

export interface EnrichedDocument extends Document {
  owner_name: string;
  owner_avatar_url: string;
  is_owner: boolean;
}

export interface DocumentWithPermission {
  document: EnrichedDocument;
  permission: string;
}

function buildAvatarUrl(seed: string, stored?: string): string {
  if (stored) return stored;
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function enrichDocument(
  doc: Document,
  currentUserId: string,
  usersMap: Map<string, { name: string; avatar_url: string }>,
  currentUserName?: string
): EnrichedDocument {
  const isOwner = doc.owner_id === currentUserId;
  const userData = usersMap.get(doc.owner_id);

  let ownerName: string;
  let avatarSeed: string;

  const ownerHash = doc.owner_id.replace('user-', '');

  if (userData?.name) {
    ownerName = userData.name;
    avatarSeed = userData.name;
  } else if (isOwner && currentUserName) {
    ownerName = currentUserName;
    avatarSeed = currentUserName;
  } else {
    ownerName = `User ${ownerHash.slice(0, 8)}`;
    avatarSeed = ownerHash;
  }

  return {
    ...doc,
    owner_name: ownerName,
    owner_avatar_url: buildAvatarUrl(avatarSeed, userData?.avatar_url),
    is_owner: isOwner,
  };
}

export async function listDocuments(
  db: D1Database,
  user: AuthenticatedUser
): Promise<EnrichedDocument[]> {
  const docs = await findDocumentsByUser(db, user.id, user.email);

  const ownerIds = Array.from(new Set(docs.map((d) => d.owner_id).filter(Boolean)));
  const usersMap = await findUsersByIds(db, ownerIds);

  return docs.map((doc) =>
    enrichDocument(doc, user.id, usersMap as any, user.name)
  );
}

export async function getDocumentById(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string
): Promise<DocumentWithPermission> {
  const doc = await findDocumentById(db, documentId);

  if (!doc) {
    const err = new Error('Document not found');
    (err as any).status = 404;
    throw err;
  }

  const isOwner = doc.owner_id === user.id;
  const collaboratorPermission = await checkCollaboratorAccess(
    db,
    documentId,
    user.id,
    user.email
  );
  const isPublic = doc.visibility === 'public';

  if (!isOwner && !collaboratorPermission && !isPublic) {
    const err = new Error('You do not have permission to access this document');
    (err as any).status = 403;
    throw err;
  }

  const permission = isOwner ? 'owner' : (collaboratorPermission ?? 'read');

  const userData = await findUserById(db, doc.owner_id);
  const usersMap: Map<string, any> = new Map();
  if (userData) usersMap.set(userData.id, userData);

  const enriched = enrichDocument(doc, user.id, usersMap, user.name);

  return { document: enriched, permission };
}

export async function createDocument(
  db: D1Database,
  user: AuthenticatedUser,
  data: { title: string; content?: string; visibility?: string }
): Promise<Document> {
  // Ensure user record exists
  try {
    await upsertUser(db, user.id, user.name, user.email, user.provider);
  } catch {
    // Non-fatal: user upsert failure should not block document creation
  }

  const id = crypto.randomUUID();
  const title = data.title?.trim() || 'New Document';
  const visibility = data.visibility === 'private' ? 'private' : 'public';
  const content = data.content ?? `# ${title}\n\nStart writing here...`;

  await createDocumentRecord(db, id, user.id, title, visibility, content);

  const now = new Date().toISOString();
  return { id, owner_id: user.id, title, visibility: visibility as 'private' | 'public', content, created_at: now, updated_at: now };
}

export async function updateDocument(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string,
  data: { content?: string; title?: string }
): Promise<DocumentWithPermission> {
  const doc = await findDocumentById(db, documentId);

  if (!doc) {
    const err = new Error('Document not found');
    (err as any).status = 404;
    throw err;
  }

  const isOwner = doc.owner_id === user.id;
  const collaboratorPermission = await checkCollaboratorAccess(
    db,
    documentId,
    user.id,
    user.email
  );
  const canWrite =
    isOwner ||
    collaboratorPermission === 'write' ||
    collaboratorPermission === 'owner';

  if (!canWrite) {
    const err = new Error('You do not have write permission for this document');
    (err as any).status = 403;
    throw err;
  }

  if (data.content === undefined && data.title === undefined) {
    const err = new Error('Provide at least one field to update: content or title');
    (err as any).status = 400;
    throw err;
  }

  await updateDocumentRecord(db, documentId, data);

  const updated = await findDocumentById(db, documentId);
  if (!updated) {
    throw new Error('Document disappeared after update');
  }

  const userData = await findUserById(db, updated.owner_id);
  const usersMap: Map<string, any> = new Map();
  if (userData) usersMap.set(userData.id, userData);

  const enriched = enrichDocument(updated, user.id, usersMap, user.name);
  const permission = isOwner ? 'owner' : (collaboratorPermission ?? 'read');

  return { document: enriched, permission };
}

export async function deleteDocument(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string
): Promise<{ documentId: string; title: string }> {
  const doc = await findDocumentById(db, documentId);

  if (!doc) {
    const err = new Error('Document not found');
    (err as any).status = 404;
    throw err;
  }

  if (doc.owner_id !== user.id) {
    const err = new Error('Only the document owner can delete it');
    (err as any).status = 403;
    throw err;
  }

  await deleteDocumentRecord(db, documentId);

  return { documentId, title: doc.title };
}
