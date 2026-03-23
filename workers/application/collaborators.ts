import type { AuthenticatedUser } from '../domain/types';
import {
  findDocumentById,
  findCollaborators,
  findUserById,
  addCollaboratorRecord,
  removeCollaboratorRecord,
  checkCollaboratorAccess,
} from '../infrastructure/db';

export interface CollaboratorEntry {
  id: string;
  email: string;
  name: string;
  permission: string;
  avatar_url: string;
  provider: string | null;
  is_current_user: boolean;
  is_owner: boolean;
  can_edit: boolean;
}

function buildAvatarUrl(seed: string, stored?: string | null): string {
  if (stored) return stored;
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export async function listCollaborators(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string
): Promise<CollaboratorEntry[]> {
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
    const err = new Error('You do not have permission to view collaborators for this document');
    (err as any).status = 403;
    throw err;
  }

  let collaborators = await findCollaborators(db, documentId);

  // If the collaborators table is empty, surface the owner as a synthetic entry
  if (collaborators.length === 0) {
    const ownerData = await findUserById(db, doc.owner_id);
    collaborators = [
      {
        user_id: doc.owner_id,
        user_email: ownerData?.email ?? 'owner@unknown.com',
        permission: 'owner',
        name: ownerData?.name ?? 'Owner',
        avatar_url: ownerData?.avatar_url ?? null,
        provider: ownerData?.provider ?? null,
      },
    ];
  }

  return collaborators.map((c: any) => {
    const isCurrentUser = c.user_id === user.id;
    const isCollabOwner = c.permission === 'owner';
    const canEdit = c.permission === 'owner' || c.permission === 'write';
    const seed = c.name || c.user_email || c.user_id;

    return {
      id: c.user_id,
      email: c.user_email,
      name: c.name ?? `User ${String(c.user_id).slice(-8)}`,
      permission: c.permission,
      avatar_url: buildAvatarUrl(seed, c.avatar_url),
      provider: c.provider ?? null,
      is_current_user: isCurrentUser,
      is_owner: isCollabOwner,
      can_edit: canEdit,
    };
  });
}

export async function addCollaborator(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string,
  email: string,
  permission: string
): Promise<void> {
  const doc = await findDocumentById(db, documentId);

  if (!doc) {
    const err = new Error('Document not found');
    (err as any).status = 404;
    throw err;
  }

  if (doc.owner_id !== user.id) {
    const err = new Error('Only the document owner can add collaborators');
    (err as any).status = 403;
    throw err;
  }

  if (!email || !email.includes('@')) {
    const err = new Error('A valid email address is required');
    (err as any).status = 400;
    throw err;
  }

  if (!['read', 'write'].includes(permission)) {
    const err = new Error('Permission must be "read" or "write"');
    (err as any).status = 400;
    throw err;
  }

  await addCollaboratorRecord(db, documentId, user.id, email, permission);
}

export async function removeCollaborator(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string,
  email: string
): Promise<void> {
  const doc = await findDocumentById(db, documentId);

  if (!doc) {
    const err = new Error('Document not found');
    (err as any).status = 404;
    throw err;
  }

  if (doc.owner_id !== user.id) {
    const err = new Error('Only the document owner can remove collaborators');
    (err as any).status = 403;
    throw err;
  }

  if (!email) {
    const err = new Error('Collaborator email is required');
    (err as any).status = 400;
    throw err;
  }

  await removeCollaboratorRecord(db, documentId, email);
}
