import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the entire infrastructure/db module before importing documents
// ---------------------------------------------------------------------------
vi.mock('../../workers/infrastructure/db', () => ({
  upsertUser: vi.fn(),
  createDocumentRecord: vi.fn(),
  findDocumentsByUser: vi.fn(),
  findDocumentById: vi.fn(),
  findUserById: vi.fn(),
  findUsersByIds: vi.fn(),
  updateDocumentRecord: vi.fn(),
  deleteDocumentRecord: vi.fn(),
  checkCollaboratorAccess: vi.fn(),
}));

import * as db from '../../workers/infrastructure/db';
import {
  createDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
} from '../../workers/application/documents';
import type { AuthenticatedUser } from '../../workers/domain/types';

// ---------------------------------------------------------------------------
// Minimal D1Database stub — functions receive db but delegate to mocked infra
// ---------------------------------------------------------------------------
const mockDb = {} as D1Database;

const owner: AuthenticatedUser = {
  id: 'user-owner1',
  email: 'owner@example.com',
  name: 'Owner User',
  provider: 'github',
};

const stranger: AuthenticatedUser = {
  id: 'user-stranger',
  email: 'stranger@example.com',
  name: 'Stranger',
  provider: 'google',
};

const baseDoc = {
  id: 'doc-1',
  owner_id: 'user-owner1',
  title: 'Existing Doc',
  content: '# Hello',
  visibility: 'public' as const,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// createDocument
// ---------------------------------------------------------------------------
describe('createDocument', () => {
  beforeEach(() => {
    vi.mocked(db.upsertUser).mockResolvedValue(undefined);
    vi.mocked(db.createDocumentRecord).mockResolvedValue(undefined);
  });

  it('generates a UUID and sets created_at / updated_at', async () => {
    const doc = await createDocument(mockDb, owner, { title: 'Hello' });

    // UUID format: 8-4-4-4-12
    expect(doc.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(doc.created_at).toBeTruthy();
    expect(doc.updated_at).toBeTruthy();
    expect(() => new Date(doc.created_at)).not.toThrow();
    expect(() => new Date(doc.updated_at)).not.toThrow();
  });

  it('sets owner_id to the authenticated user id', async () => {
    const doc = await createDocument(mockDb, owner, { title: 'My doc' });
    expect(doc.owner_id).toBe('user-owner1');
  });

  it('defaults title to "New Document" when title is empty', async () => {
    const doc = await createDocument(mockDb, owner, { title: '' });
    expect(doc.title).toBe('New Document');
  });

  it('defaults visibility to public when not specified', async () => {
    const doc = await createDocument(mockDb, owner, { title: 'Test' });
    expect(doc.visibility).toBe('public');
  });

  it('sets visibility to private when explicitly requested', async () => {
    const doc = await createDocument(mockDb, owner, { title: 'Secret', visibility: 'private' });
    expect(doc.visibility).toBe('private');
  });

  it('calls createDocumentRecord with the generated id', async () => {
    const doc = await createDocument(mockDb, owner, { title: 'Tracked' });
    expect(vi.mocked(db.createDocumentRecord)).toHaveBeenCalledWith(
      mockDb,
      doc.id,
      owner.id,
      'Tracked',
      'public',
      expect.any(String)
    );
  });

  it('continues document creation even when upsertUser throws', async () => {
    vi.mocked(db.upsertUser).mockRejectedValue(new Error('DB unavailable'));
    const doc = await createDocument(mockDb, owner, { title: 'Resilient' });
    expect(doc.title).toBe('Resilient');
  });
});

// ---------------------------------------------------------------------------
// updateDocument
// ---------------------------------------------------------------------------
describe('updateDocument', () => {
  const updatedDoc = { ...baseDoc, title: 'Updated Title', updated_at: '2024-01-02T00:00:00.000Z' };

  it('allows owner to update their document', async () => {
    vi.mocked(db.findDocumentById)
      .mockResolvedValueOnce(baseDoc)   // first call: existence check
      .mockResolvedValueOnce(updatedDoc); // second call: re-fetch after update
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValue(null);
    vi.mocked(db.updateDocumentRecord).mockResolvedValue(undefined);
    vi.mocked(db.findUserById).mockResolvedValue(null);

    const result = await updateDocument(mockDb, owner, 'doc-1', { title: 'Updated Title' });
    expect(result.document.title).toBe('Updated Title');
    expect(result.permission).toBe('owner');
  });

  it('allows a collaborator with write permission to update', async () => {
    vi.mocked(db.findDocumentById)
      .mockResolvedValueOnce(baseDoc)
      .mockResolvedValueOnce(updatedDoc);
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValue('write');
    vi.mocked(db.updateDocumentRecord).mockResolvedValue(undefined);
    vi.mocked(db.findUserById).mockResolvedValue(null);

    const result = await updateDocument(mockDb, stranger, 'doc-1', { content: 'New content' });
    expect(result.permission).toBe('write');
  });

  it('throws 403 when user is not owner and not a collaborator', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(baseDoc);
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValue(null);

    await expect(
      updateDocument(mockDb, stranger, 'doc-1', { title: 'Hijack' })
    ).rejects.toMatchObject({ message: 'You do not have write permission for this document' });
  });

  it('throws 403 when collaborator only has read permission', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(baseDoc);
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValue('read');

    await expect(
      updateDocument(mockDb, stranger, 'doc-1', { content: 'attempt' })
    ).rejects.toMatchObject({ message: 'You do not have write permission for this document' });
  });

  it('throws 404 when document does not exist', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(null);

    await expect(
      updateDocument(mockDb, owner, 'nonexistent', { title: 'X' })
    ).rejects.toMatchObject({ message: 'Document not found' });
  });

  it('throws 400 when neither content nor title is provided', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(baseDoc);
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValue(null);

    await expect(
      updateDocument(mockDb, owner, 'doc-1', {})
    ).rejects.toMatchObject({ message: expect.stringContaining('at least one field') });
  });
});

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------
describe('deleteDocument', () => {
  const deletableDoc = {
    id: 'doc-2',
    owner_id: 'user-owner1',
    title: 'To Be Deleted',
    content: '',
    visibility: 'public' as const,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  it('allows the owner to delete their document', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(deletableDoc);
    vi.mocked(db.deleteDocumentRecord).mockResolvedValue(undefined);

    const result = await deleteDocument(mockDb, owner, 'doc-2');
    expect(result.documentId).toBe('doc-2');
    expect(result.title).toBe('To Be Deleted');
  });

  it('calls deleteDocumentRecord with the correct document id', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(deletableDoc);
    vi.mocked(db.deleteDocumentRecord).mockResolvedValue(undefined);

    await deleteDocument(mockDb, owner, 'doc-2');
    expect(vi.mocked(db.deleteDocumentRecord)).toHaveBeenCalledWith(mockDb, 'doc-2');
  });

  it('throws 403 when a non-owner tries to delete', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(deletableDoc);

    await expect(
      deleteDocument(mockDb, stranger, 'doc-2')
    ).rejects.toMatchObject({ message: 'Only the document owner can delete it' });
  });

  it('throws 404 when document does not exist', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(null);

    await expect(
      deleteDocument(mockDb, owner, 'ghost-doc')
    ).rejects.toMatchObject({ message: 'Document not found' });
  });
});

// ---------------------------------------------------------------------------
// listDocuments
// ---------------------------------------------------------------------------
describe('listDocuments', () => {
  const publicDoc = {
    id: 'pub-1',
    owner_id: 'user-other',
    title: 'Public Doc',
    content: '',
    visibility: 'public' as const,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const privateDoc = {
    id: 'priv-1',
    owner_id: 'user-owner1',
    title: 'Private Doc',
    content: '',
    visibility: 'private' as const,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.mocked(db.findUsersByIds).mockResolvedValue(new Map());
  });

  it('returns all documents returned by the infrastructure layer', async () => {
    vi.mocked(db.findDocumentsByUser).mockResolvedValue([publicDoc, privateDoc]);

    const docs = await listDocuments(mockDb, owner);
    expect(docs).toHaveLength(2);
  });

  it('marks documents owned by the current user as is_owner=true', async () => {
    vi.mocked(db.findDocumentsByUser).mockResolvedValue([publicDoc, privateDoc]);

    const docs = await listDocuments(mockDb, owner);
    const owned = docs.find((d) => d.id === 'priv-1');
    expect(owned?.is_owner).toBe(true);
  });

  it('marks documents not owned by the current user as is_owner=false', async () => {
    vi.mocked(db.findDocumentsByUser).mockResolvedValue([publicDoc, privateDoc]);

    const docs = await listDocuments(mockDb, owner);
    const notOwned = docs.find((d) => d.id === 'pub-1');
    expect(notOwned?.is_owner).toBe(false);
  });

  it('returns empty array when user has no accessible documents', async () => {
    vi.mocked(db.findDocumentsByUser).mockResolvedValue([]);

    const docs = await listDocuments(mockDb, owner);
    expect(docs).toHaveLength(0);
  });

  it('calls findDocumentsByUser with user id and email', async () => {
    vi.mocked(db.findDocumentsByUser).mockResolvedValue([]);

    await listDocuments(mockDb, owner);
    expect(vi.mocked(db.findDocumentsByUser)).toHaveBeenCalledWith(
      mockDb,
      owner.id,
      owner.email
    );
  });
});
