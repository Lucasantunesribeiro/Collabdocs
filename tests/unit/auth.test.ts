import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyToken } from '../../workers/middleware/auth';

// ---------------------------------------------------------------------------
// Helpers to create minimal HS256 JWTs for testing
// ---------------------------------------------------------------------------

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function signHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signingInput));
  const signatureBytes = new Uint8Array(signatureBuffer);
  const signatureB64 = Buffer.from(signatureBytes).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${header}.${body}.${signatureB64}`;
}

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new Request('http://localhost/', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyToken', () => {
  const SECRET = 'test-secret-32-chars-long-enough!!';

  it('returns null when Authorization header is missing', async () => {
    const req = makeRequest();
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null when Authorization header does not start with Bearer', async () => {
    const req = makeRequest('Basic dXNlcjpwYXNz');
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null when Bearer token is empty string', async () => {
    const req = makeRequest('Bearer ');
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a malformed token (not 3 parts)', async () => {
    const req = makeRequest('Bearer not.a.valid.jwt.here');
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    const token = await signHS256(
      { sub: 'abc123', email: 'user@example.com', name: 'Test User', exp: Math.floor(Date.now() / 1000) + 3600 },
      'wrong-secret'
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expiredToken = await signHS256(
      { sub: 'abc123', email: 'user@example.com', name: 'Test User', exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET
    );
    const req = makeRequest(`Bearer ${expiredToken}`);
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null when payload is missing sub', async () => {
    const token = await signHS256(
      { email: 'user@example.com', name: 'Test User', exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null when payload is missing email', async () => {
    const token = await signHS256(
      { sub: 'abc123', name: 'Test User', exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns null when email is invalid (no @ sign)', async () => {
    const token = await signHS256(
      { sub: 'abc123', email: 'notanemail', name: 'Test User', exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);
    expect(result).toBeNull();
  });

  it('returns AuthenticatedUser for a valid token', async () => {
    const token = await signHS256(
      {
        sub: 'abc123',
        email: 'user@example.com',
        name: 'Test User',
        provider: 'github',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      SECRET
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-abc123');
    expect(result?.email).toBe('user@example.com');
    expect(result?.name).toBe('Test User');
    expect(result?.provider).toBe('github');
  });

  it('uses "unknown" as provider when provider claim is absent', async () => {
    const token = await signHS256(
      { sub: 'xyz999', email: 'other@example.com', name: 'Other', exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);

    expect(result?.provider).toBe('unknown');
  });

  it('accepts a token with no exp claim (no expiration)', async () => {
    const token = await signHS256(
      { sub: 'noexp', email: 'noexp@example.com', name: 'NoExp' },
      SECRET
    );
    const req = makeRequest(`Bearer ${token}`);
    const result = await verifyToken(req, SECRET);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-noexp');
  });
});
