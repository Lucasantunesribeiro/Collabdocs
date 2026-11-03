import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../workers/infrastructure/db', () => ({
  findDocumentById: vi.fn(),
  checkCollaboratorAccess: vi.fn(),
  findCollaborators: vi.fn(),
  findUserById: vi.fn(),
  addCollaboratorRecord: vi.fn(),
  removeCollaboratorRecord: vi.fn(),
  logAuditEvent: vi.fn(),
}));

import * as db from '../../workers/infrastructure/db';
import {
  ALL_OPERATIONS,
  ALL_ROLES,
  assertCan,
  can,
  resolveRole,
  type DocumentOperation,
  type DocumentRole,
} from '../../workers/domain/authorization';
import {
  addCollaborator,
  listCollaborators,
  removeCollaborator,
} from '../../workers/application/collaborators';
import { getDocumentById } from '../../workers/application/documents';
import {
  buildVerifiedSessionUrl,
  computeSessionExpiry,
  MAX_REALTIME_SESSION_MS,
  resolveRealtimeRole,
  VERIFIED_PARAMS,
} from '../../workers/collaboration/access';
import { isSessionExpired, parseClientMessage, MAX_MESSAGE_BYTES } from '../../workers/collaboration/messages';
import type { AuthenticatedUser } from '../../workers/domain/types';

const mockDb = {} as D1Database;
const DOC_ID = '0b6f6f3e-1a2b-4c3d-8e9f-0123456789ab';

const owner: AuthenticatedUser = { id: 'user-owner', email: 'owner@test.com', name: 'Owner', provider: 'github' };
const actor: AuthenticatedUser = { id: 'user-actor', email: 'actor@test.com', name: 'Actor', provider: 'google' };

function doc(visibility: 'public' | 'private' = 'private') {
  return {
    id: DOC_ID,
    owner_id: owner.id,
    title: 'Doc',
    content: 'segredo',
    visibility,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.mocked(db.findDocumentById).mockReset();
  vi.mocked(db.checkCollaboratorAccess).mockReset();
  vi.mocked(db.findCollaborators).mockReset().mockResolvedValue([]);
  vi.mocked(db.findUserById).mockReset().mockResolvedValue(null);
  vi.mocked(db.addCollaboratorRecord).mockReset();
  vi.mocked(db.removeCollaboratorRecord).mockReset();
});

// ---------------------------------------------------------------------------
// Matriz papel x operação
// ---------------------------------------------------------------------------
describe('authorization matrix', () => {
  const allowed: Record<DocumentOperation, DocumentRole[]> = {
    read: ['public_reader', 'viewer', 'editor', 'owner'],
    connect_realtime: ['public_reader', 'viewer', 'editor', 'owner'],
    list_collaborators: ['viewer', 'editor', 'owner'],
    edit_content: ['editor', 'owner'],
    rename: ['editor', 'owner'],
    send_realtime_update: ['editor', 'owner'],
    change_visibility: ['owner'],
    delete: ['owner'],
    manage_collaborators: ['owner'],
  };

  for (const role of ALL_ROLES) {
    for (const op of ALL_OPERATIONS) {
      const expected = allowed[op].includes(role);
      it(`${role} ${expected ? 'can' : 'cannot'} ${op}`, () => {
        expect(can(role, op)).toBe(expected);
      });
    }
  }

  it('assertCan: no read => 404, read without op => 403', () => {
    expect(() => assertCan('none', 'read')).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => assertCan('none', 'delete')).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => assertCan('viewer', 'edit_content')).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => assertCan('editor', 'edit_content', 'rename')).not.toThrow();
  });

  it('resolveRole: owner, collaborators, public reader and stranger', () => {
    expect(resolveRole(doc(), owner.id, null)).toBe('owner');
    expect(resolveRole(doc(), actor.id, 'read')).toBe('viewer');
    expect(resolveRole(doc(), actor.id, 'write')).toBe('editor');
    // Linha legada "owner" em document_collaborators não concede posse.
    expect(resolveRole(doc(), actor.id, 'owner')).toBe('editor');
    expect(resolveRole(doc('public'), actor.id, null)).toBe('public_reader');
    expect(resolveRole(doc(), actor.id, null)).toBe('none');
    expect(resolveRole(null, owner.id, null)).toBe('none');
    expect(resolveRole(doc(), '', null)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Casos de uso protegidos
// ---------------------------------------------------------------------------
describe('getDocumentById', () => {
  it('returns the same 404 for a private document without access and for an unknown id', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce(null);
    const hidden = await getDocumentById(mockDb, actor, DOC_ID).catch((e) => e);

    vi.mocked(db.findDocumentById).mockResolvedValueOnce(null);
    const missing = await getDocumentById(mockDb, actor, DOC_ID).catch((e) => e);

    expect(hidden).toMatchObject({ status: 404, message: 'Document not found' });
    expect(missing).toMatchObject({ status: 404, message: 'Document not found' });
  });

  it('returns the effective permission of a collaborator', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce('read');
    const result = await getDocumentById(mockDb, actor, DOC_ID);
    expect(result.permission).toBe('read');
    expect(result.document.is_owner).toBe(false);
  });
});

describe('collaborator management', () => {
  it('owner adds a collaborator with normalized email', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    await addCollaborator(mockDb, owner, DOC_ID, '  New@Test.COM ', 'write');
    expect(vi.mocked(db.addCollaboratorRecord)).toHaveBeenCalledWith(mockDb, DOC_ID, owner.id, 'new@test.com', 'write');
  });

  it.each(['read', 'write', 'owner'])('collaborator with %s cannot add collaborators nor promote self', async (perm) => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce(perm);
    await expect(addCollaborator(mockDb, actor, DOC_ID, actor.email, 'write')).rejects.toMatchObject({ status: 403 });
    expect(vi.mocked(db.addCollaboratorRecord)).not.toHaveBeenCalled();
  });

  it('stranger on a private doc gets 404 when adding collaborators', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce(null);
    await expect(addCollaborator(mockDb, actor, DOC_ID, 'x@test.com', 'read')).rejects.toMatchObject({ status: 404 });
  });

  it('owner cannot grant "owner" permission', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    await expect(addCollaborator(mockDb, owner, DOC_ID, 'x@test.com', 'owner')).rejects.toMatchObject({ status: 400 });
    expect(vi.mocked(db.addCollaboratorRecord)).not.toHaveBeenCalled();
  });

  it('owner cannot add their own email as collaborator', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    await expect(addCollaborator(mockDb, owner, DOC_ID, 'OWNER@test.com', 'read')).rejects.toMatchObject({ status: 400 });
  });

  it('editor cannot remove collaborators', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce('write');
    await expect(removeCollaborator(mockDb, actor, DOC_ID, 'other@test.com')).rejects.toMatchObject({ status: 403 });
    expect(vi.mocked(db.removeCollaboratorRecord)).not.toHaveBeenCalled();
  });

  it('public reader gets an empty collaborator list (no email leak)', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc('public'));
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce(null);
    vi.mocked(db.findCollaborators).mockResolvedValueOnce([
      { user_id: '', user_email: 'secret@test.com', permission: 'write' },
    ]);
    await expect(listCollaborators(mockDb, actor, DOC_ID)).resolves.toEqual([]);
  });

  it('viewer can list collaborators', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce('read');
    vi.mocked(db.findCollaborators).mockResolvedValueOnce([
      { user_id: '', user_email: 'actor@test.com', permission: 'read' },
    ]);
    const list = await listCollaborators(mockDb, actor, DOC_ID);
    expect(list).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// WebSocket: autorização antes do upgrade
// ---------------------------------------------------------------------------
describe('resolveRealtimeRole', () => {
  const env = (url?: string) => ({ DB: mockDb, DOCUMENTS_API_URL: url });

  function apiResponse(status: number, body?: unknown) {
    return vi.fn().mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), { status })
    ) as unknown as typeof fetch;
  }

  it.each([
    ['owner', 'owner'],
    ['write', 'editor'],
    ['read', 'viewer'],
  ])('maps .NET permission %s to role %s', async (permission, role) => {
    const fetchImpl = apiResponse(200, { document: { id: DOC_ID, permission } });
    await expect(resolveRealtimeRole(env('https://api.test/api/'), DOC_ID, actor, 'jwt', fetchImpl)).resolves.toBe(role);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.test/api/documents/${DOC_ID}`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer jwt' }) })
    );
  });

  it.each([401, 403, 404, 500])('denies when the .NET API answers %i', async (status) => {
    await expect(
      resolveRealtimeRole(env('https://api.test/api'), DOC_ID, actor, 'jwt', apiResponse(status, { error: 'x' }))
    ).resolves.toBe('none');
  });

  it('denies (fail-closed) on network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
    await expect(resolveRealtimeRole(env('https://api.test/api'), DOC_ID, actor, 'jwt', fetchImpl)).resolves.toBe('none');
  });

  it('denies when the API response has no document id', async () => {
    const fetchImpl = apiResponse(200, { document: { permission: 'owner' } });
    await expect(resolveRealtimeRole(env('https://api.test/api'), DOC_ID, actor, 'jwt', fetchImpl)).resolves.toBe('none');
  });

  it('denies when the API returns a different document id', async () => {
    const fetchImpl = apiResponse(200, { document: { id: '11111111-1111-4111-8111-111111111111', permission: 'owner' } });
    await expect(resolveRealtimeRole(env('https://api.test/api'), DOC_ID, actor, 'jwt', fetchImpl)).resolves.toBe('none');
  });

  it('falls back to D1 when DOCUMENTS_API_URL is not set', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce('read');
    await expect(resolveRealtimeRole(env(), DOC_ID, actor, 'jwt')).resolves.toBe('viewer');
  });

  it('D1: stranger on private doc and unknown doc are denied', async () => {
    vi.mocked(db.findDocumentById).mockResolvedValueOnce(doc());
    vi.mocked(db.checkCollaboratorAccess).mockResolvedValueOnce(null);
    await expect(resolveRealtimeRole(env(), DOC_ID, actor, 'jwt')).resolves.toBe('none');

    vi.mocked(db.findDocumentById).mockResolvedValueOnce(null);
    await expect(resolveRealtimeRole(env(), DOC_ID, actor, 'jwt')).resolves.toBe('none');
  });

  it('D1: database failure denies instead of failing open', async () => {
    vi.mocked(db.findDocumentById).mockRejectedValueOnce(new Error('D1 unavailable'));
    await expect(resolveRealtimeRole(env(), DOC_ID, actor, 'jwt')).resolves.toBe('none');
  });
});

describe('buildVerifiedSessionUrl', () => {
  it('drops the token and client-supplied __verified_* params', () => {
    const url = new URL(
      buildVerifiedSessionUrl(
        `https://w.test/api/documents/${DOC_ID}/ws?token=jwt&__verified_role=owner&__verified_userId=victim`,
        DOC_ID,
        actor,
        'viewer'
      )
    );
    expect(url.searchParams.get('token')).toBeNull();
    expect(url.searchParams.getAll(VERIFIED_PARAMS.role)).toEqual(['viewer']);
    expect(url.searchParams.getAll(VERIFIED_PARAMS.userId)).toEqual([actor.id]);
    expect(url.searchParams.get(VERIFIED_PARAMS.documentId)).toBe(DOC_ID);
  });

  it('sets a server-computed expiry and ignores one supplied by the client', () => {
    const url = new URL(
      buildVerifiedSessionUrl(
        `https://w.test/api/documents/${DOC_ID}/ws?token=jwt&__verified_expiresAt=99999999999999`,
        DOC_ID,
        actor,
        'editor',
        1_000
      )
    );
    expect(url.searchParams.getAll(VERIFIED_PARAMS.expiresAt)).toEqual(['1000']);
  });
});

describe('computeSessionExpiry (revalidação periódica do WebSocket)', () => {
  const now = 1_700_000_000_000;

  it('caps the session at MAX_REALTIME_SESSION_MS even for long-lived tokens', () => {
    const exp30d = Math.floor(now / 1000) + 30 * 24 * 3600;
    expect(computeSessionExpiry(exp30d, now)).toBe(now + MAX_REALTIME_SESSION_MS);
  });

  it('ends the session when the JWT expires, if that comes first', () => {
    const exp = Math.floor(now / 1000) + 60;
    expect(computeSessionExpiry(exp, now)).toBe(exp * 1000);
  });

  it('falls back to the cap when exp is unknown', () => {
    expect(computeSessionExpiry(undefined, now)).toBe(now + MAX_REALTIME_SESSION_MS);
  });

  it('isSessionExpired is fail-closed for missing/invalid expiry', () => {
    expect(isSessionExpired({ expiresAt: NaN }, now)).toBe(true);
    expect(isSessionExpired({ expiresAt: now }, now)).toBe(true);
    expect(isSessionExpired({ expiresAt: now + 1 }, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WebSocket: autorização por mensagem dentro do Durable Object
// ---------------------------------------------------------------------------
describe('parseClientMessage', () => {
  const identity = (role: DocumentRole, expiresAt = Date.now() + 60_000) => ({
    userId: 'user-actor',
    userName: 'Actor',
    documentId: DOC_ID,
    role,
    expiresAt,
  });

  it('rejects every message once the session authorization has expired (even from the owner)', () => {
    const expired = identity('owner', Date.now() - 1);
    expect(parseClientMessage(JSON.stringify({ type: 'update', content: 'late' }), expired))
      .toEqual({ ok: false, reason: 'expired' });
    expect(parseClientMessage(JSON.stringify({ type: 'cursor', cursor: { line: 0, ch: 0 } }), expired))
      .toEqual({ ok: false, reason: 'expired' });
  });

  it.each<DocumentRole>(['viewer', 'public_reader'])('%s cannot broadcast content updates', (role) => {
    const r = parseClientMessage(JSON.stringify({ type: 'update', content: 'pwned' }), identity(role));
    expect(r).toEqual({ ok: false, reason: 'forbidden' });
  });

  it.each<DocumentRole>(['editor', 'owner'])('%s update is relayed with server-verified identity', (role) => {
    const r = parseClientMessage(
      JSON.stringify({ type: 'update', content: 'ok', userId: 'spoofed', userName: 'Admin', documentId: 'other' }),
      identity(role)
    );
    expect(r).toEqual({
      ok: true,
      message: { type: 'update', userId: 'user-actor', userName: 'Actor', documentId: DOC_ID, content: 'ok' },
    });
  });

  it('viewer can share cursor position (presence only)', () => {
    const r = parseClientMessage(JSON.stringify({ type: 'cursor', cursor: { line: 1, ch: 2 } }), identity('viewer'));
    expect(r.ok).toBe(true);
  });

  it.each(['join', 'leave', 'connected', 'error'])('client cannot forge server message type %s', (type) => {
    const r = parseClientMessage(JSON.stringify({ type, userId: 'victim' }), identity('owner'));
    expect(r).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('rejects malformed, non-string and oversized payloads', () => {
    expect(parseClientMessage('{not json', identity('owner'))).toEqual({ ok: false, reason: 'malformed' });
    expect(parseClientMessage(new ArrayBuffer(4), identity('owner'))).toEqual({ ok: false, reason: 'unsupported' });
    expect(parseClientMessage(JSON.stringify({ type: 'update', content: 1 }), identity('owner')))
      .toEqual({ ok: false, reason: 'malformed' });
    const big = JSON.stringify({ type: 'update', content: 'x'.repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(big, identity('owner'))).toEqual({ ok: false, reason: 'too_large' });
  });
});
