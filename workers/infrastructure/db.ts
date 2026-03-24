import type { Document } from '../domain/types';
import { logger } from '../lib/logger';

// D1Database is available as a global in the Cloudflare Workers runtime
declare const D1Database: any;

export async function upsertUser(
  db: D1Database,
  userId: string,
  name: string,
  email: string,
  provider: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT OR REPLACE INTO users (id, name, email, avatar_url, provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, name, email, '', provider, now, now)
    .run();
}

export async function createDocumentRecord(
  db: D1Database,
  id: string,
  ownerId: string,
  title: string,
  visibility: string,
  content: string
): Promise<void> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, ownerId, title, visibility, now, now, content)
    .run();

  if (!result.success) {
    throw new Error('Failed to create document record');
  }
}

export async function findDocumentsByUser(
  db: D1Database,
  userId: string,
  email: string
): Promise<Document[]> {
  // Use simple query first; fall back to join if collaborators table exists
  try {
    const result = await db
      .prepare(
        `SELECT DISTINCT d.id, d.title, d.visibility, d.owner_id, d.created_at, d.updated_at, d.content
         FROM documents d
         LEFT JOIN document_collaborators dc ON d.id = dc.document_id
         WHERE
           d.visibility = 'public'
           OR d.owner_id = ?
           OR (dc.user_id = ? AND dc.permission IN ('read', 'write', 'owner'))
           OR (dc.user_email = ? AND dc.permission IN ('read', 'write', 'owner'))
         ORDER BY d.updated_at DESC`
      )
      .bind(userId, userId, email)
      .all();
    return (result.results ?? []) as unknown as Document[];
  } catch {
    // Fallback: collaborators table may not exist yet
    const result = await db
      .prepare(
        `SELECT id, title, visibility, owner_id, created_at, updated_at, content
         FROM documents
         WHERE visibility = 'public' OR owner_id = ?
         ORDER BY updated_at DESC`
      )
      .bind(userId)
      .all();
    return ((result.results ?? []) as any[]).map((r) => ({ ...r, content: r.content ?? '' })) as Document[];
  }
}

export async function findDocumentById(
  db: D1Database,
  id: string
): Promise<Document | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, title, visibility, content, created_at, updated_at
       FROM documents WHERE id = ?`
    )
    .bind(id)
    .first();
  return (row as unknown as Document) ?? null;
}

export async function updateDocumentRecord(
  db: D1Database,
  id: string,
  fields: Partial<{ content: string; title: string }>,
  expectedVersion?: number
): Promise<void> {
  const setClauses: string[] = [];
  const values: any[] = [];

  if (fields.content !== undefined) {
    setClauses.push('content = ?');
    values.push(fields.content);
  }
  if (fields.title !== undefined) {
    setClauses.push('title = ?');
    values.push(fields.title);
  }

  if (setClauses.length === 0) {
    throw new Error('No fields to update');
  }

  // Always increment version on every update
  setClauses.push('version = version + 1');
  setClauses.push('updated_at = ?');
  values.push(new Date().toISOString());

  // Build WHERE clause — optionally lock on expected version
  if (expectedVersion !== undefined) {
    values.push(id);
    values.push(expectedVersion);
    const result = await db
      .prepare(`UPDATE documents SET ${setClauses.join(', ')} WHERE id = ? AND version = ?`)
      .bind(...values)
      .run();

    if (!result.success) {
      throw new Error('Failed to update document record');
    }

    // D1 returns changes === 0 when the version predicate did not match
    if (result.meta.changes === 0) {
      const conflictErr = new Error('Document was modified by another user');
      (conflictErr as any).status = 409;
      throw conflictErr;
    }
  } else {
    values.push(id);
    const result = await db
      .prepare(`UPDATE documents SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    if (!result.success) {
      throw new Error('Failed to update document record');
    }
  }
}

export async function deleteDocumentRecord(
  db: D1Database,
  id: string
): Promise<void> {
  // Remove collaborators first (ignore if table doesn't exist)
  try {
    await db
      .prepare('DELETE FROM document_collaborators WHERE document_id = ?')
      .bind(id)
      .run();
  } catch {
    // table may not exist
  }

  const result = await db
    .prepare('DELETE FROM documents WHERE id = ?')
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    throw new Error('Document not found or already deleted');
  }
}

export async function findCollaborators(
  db: D1Database,
  documentId: string
): Promise<any[]> {
  try {
    const result = await db
      .prepare(
        `SELECT
           dc.user_id,
           dc.user_email,
           dc.permission,
           u.name,
           u.avatar_url,
           u.provider
         FROM document_collaborators dc
         LEFT JOIN users u ON dc.user_id = u.id
         WHERE dc.document_id = ?
         ORDER BY
           CASE dc.permission
             WHEN 'owner' THEN 1
             WHEN 'write' THEN 2
             WHEN 'read' THEN 3
             ELSE 4
           END,
           u.name ASC`
      )
      .bind(documentId)
      .all();
    return (result.results ?? []) as any[];
  } catch {
    return [];
  }
}

export async function addCollaboratorRecord(
  db: D1Database,
  documentId: string,
  userId: string,
  email: string,
  permission: string
): Promise<void> {
  // Upsert: update if exists, insert if not
  const existing = await db
    .prepare(
      'SELECT id FROM document_collaborators WHERE document_id = ? AND user_email = ?'
    )
    .bind(documentId, email)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE document_collaborators
         SET permission = ?, updated_at = datetime('now')
         WHERE document_id = ? AND user_email = ?`
      )
      .bind(permission, documentId, email)
      .run();
  } else {
    const collabId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO document_collaborators
           (id, document_id, user_email, permission, added_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(collabId, documentId, email, permission, userId)
      .run();
  }
}

export async function removeCollaboratorRecord(
  db: D1Database,
  documentId: string,
  email: string
): Promise<void> {
  const result = await db
    .prepare(
      'DELETE FROM document_collaborators WHERE document_id = ? AND user_email = ?'
    )
    .bind(documentId, email)
    .run();

  if (result.meta.changes === 0) {
    throw new Error('Collaborator not found');
  }
}

/**
 * Returns true if the user may access the document:
 * owner, explicit collaborator (by userId or email), or the document is public.
 */
export async function hasDocumentAccess(
  db: D1Database,
  documentId: string,
  userId: string,
  email: string
): Promise<boolean> {
  try {
    const row = await db
      .prepare(
        `SELECT 1 FROM documents d
         LEFT JOIN document_collaborators dc ON d.id = dc.document_id
         WHERE d.id = ?
           AND (
             d.visibility = 'public'
             OR d.owner_id = ?
             OR (dc.user_id = ? AND dc.permission IN ('read', 'write', 'owner'))
             OR (dc.user_email = ? AND dc.permission IN ('read', 'write', 'owner'))
           )
         LIMIT 1`
      )
      .bind(documentId, userId, userId, email)
      .first();
    return row !== null;
  } catch {
    // Fail-open: if the DB is unavailable don't block the session
    return true;
  }
}

export async function checkCollaboratorAccess(
  db: D1Database,
  documentId: string,
  userId: string,
  email: string
): Promise<string | null> {
  try {
    const row = await db
      .prepare(
        `SELECT permission FROM document_collaborators
         WHERE document_id = ? AND (user_id = ? OR user_email = ?)`
      )
      .bind(documentId, userId, email)
      .first();
    return row ? (row.permission as string) : null;
  } catch {
    return null;
  }
}

export async function findUserById(
  db: D1Database,
  userId: string
): Promise<{ id: string; name: string; email: string; avatar_url: string; provider: string } | null> {
  try {
    const row = await db
      .prepare('SELECT id, name, email, avatar_url, provider FROM users WHERE id = ?')
      .bind(userId)
      .first();
    return row as any ?? null;
  } catch {
    return null;
  }
}

export async function findUsersByIds(
  db: D1Database,
  userIds: string[]
): Promise<Map<string, { id: string; name: string; email: string; avatar_url: string; provider: string }>> {
  const map = new Map();
  if (userIds.length === 0) return map;

  try {
    const placeholders = userIds.map(() => '?').join(',');
    const result = await db
      .prepare(`SELECT id, name, email, avatar_url, provider FROM users WHERE id IN (${placeholders})`)
      .bind(...userIds)
      .all();
    for (const user of (result.results ?? []) as any[]) {
      map.set(user.id, user);
    }
  } catch {
    // users table may not exist
  }

  return map;
}

export async function getRateLimitCount(
  db: D1Database,
  key: string
): Promise<number> {
  const now = Date.now();
  const row = await db
    .prepare(
      'SELECT request_count FROM rate_limits WHERE key = ? AND window_end > ?'
    )
    .bind(key, now)
    .first();
  return row ? (row.request_count as number) : 0;
}

export async function incrementRateLimit(
  db: D1Database,
  key: string,
  windowEnd: number
): Promise<void> {
  // Two-step upsert: if the row exists and the window is still active, increment.
  // If the row doesn't exist or the window has expired, insert/replace with count=1.
  await db
    .prepare(
      `INSERT INTO rate_limits (key, request_count, window_end)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         request_count = CASE
           WHEN window_end > ? THEN request_count + 1
           ELSE 1
         END,
         window_end = CASE
           WHEN window_end > ? THEN window_end
           ELSE ?
         END`
    )
    .bind(key, windowEnd, Date.now(), Date.now(), windowEnd)
    .run()
    .catch(() => {
      // Graceful degradation: rate_limits table may not exist yet
    });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'viewed'
  | 'collaborator_added'
  | 'collaborator_removed';

export async function logAuditEvent(
  db: D1Database,
  documentId: string,
  userId: string,
  action: AuditAction,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    await db
      .prepare(
        `INSERT INTO document_audit_log (id, document_id, user_id, action, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, documentId, userId, action, metadataStr, createdAt)
      .run();
  } catch (err) {
    // Audit failures must never break the main flow — log and continue
    logger.warn('Failed to write audit log entry', {
      documentId,
      userId,
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
