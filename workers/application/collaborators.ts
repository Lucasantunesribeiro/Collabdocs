import type { AuthenticatedUser } from '../domain/types';
import type { EmailNotificationMessage } from '../queues/emailConsumer';
import {
  findCollaborators,
  findUserById,
  addCollaboratorRecord,
  removeCollaboratorRecord,
  logAuditEvent,
} from '../infrastructure/db';
import { logger } from '../lib/logger';
import { authorizeDocument } from './access';
import { can, normalizeEmail } from '../domain/authorization';

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
  const { doc, role } = await authorizeDocument(db, user, documentId, 'read');

  // Leitor de documento público (não colaborador) não vê e-mails de colaboradores.
  if (!can(role, 'list_collaborators')) return [];

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
  permission: string,
  notificationQueue?: Queue<EmailNotificationMessage>
): Promise<void> {
  const { doc } = await authorizeDocument(db, user, documentId, 'manage_collaborators');

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    const err = new Error('A valid email address is required');
    (err as any).status = 400;
    throw err;
  }

  // "owner" é rejeitado: posse não é transferível/compartilhável por esta rota.
  if (!['read', 'write'].includes(permission)) {
    const err = new Error('Permission must be "read" or "write"');
    (err as any).status = 400;
    throw err;
  }

  email = normalizeEmail(email);
  if (email === normalizeEmail(user.email)) {
    const err = new Error('The document owner cannot be added as a collaborator');
    (err as any).status = 400;
    throw err;
  }

  await addCollaboratorRecord(db, documentId, user.id, email, permission);

  logger.info('Collaborator added', { documentId, userId: user.id, email, permission });

  await logAuditEvent(db, documentId, user.id, 'collaborator_added', { email });

  if (notificationQueue) {
    try {
      await notificationQueue.send({
        type: 'collaborator_added',
        toEmail: email,
        toName: email.split('@')[0],
        documentTitle: doc.title,
        documentId,
        addedByName: user.name,
        permission,
      });
    } catch (err) {
      logger.warn('Failed to enqueue email notification', { email, documentId });
    }
  }
}

export async function removeCollaborator(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string,
  email: string
): Promise<void> {
  await authorizeDocument(db, user, documentId, 'manage_collaborators');

  if (!email) {
    const err = new Error('Collaborator email is required');
    (err as any).status = 400;
    throw err;
  }

  email = normalizeEmail(email);

  await removeCollaboratorRecord(db, documentId, email);

  logger.info('Collaborator removed', { documentId, userId: user.id, email });

  await logAuditEvent(db, documentId, user.id, 'collaborator_removed', { email });
}
