import type { AuthenticatedUser } from '../domain/types';

/**
 * Verifies a NextAuth JWT (HS256) from the Authorization: Bearer header.
 * NextAuth signs tokens with NEXTAUTH_SECRET using HS256.
 * The sub claim holds the provider-specific user ID.
 * We store users as `user-${sub}` to match the existing convention.
 */
export async function verifyToken(
  request: Request,
  secret: string
): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return null;
  }

  return verifyTokenString(token, secret);
}

/**
 * Verifies a NextAuth JWT passed as a query parameter.
 * Used for WebSocket upgrades where browsers cannot set Authorization headers.
 */
export async function verifyWebSocketToken(
  request: Request,
  secret: string
): Promise<AuthenticatedUser | null> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return null;
  return verifyTokenString(token, secret);
}

async function verifyTokenString(
  token: string,
  secret: string
): Promise<AuthenticatedUser | null> {

  try {
    const payload = await verifyJWT(token, secret);
    if (!payload) return null;

    const sub = payload.sub as string | undefined;
    const email = payload.email as string | undefined;
    const name = (payload.name as string | undefined) ?? '';
    const provider = (payload.provider as string | undefined) ?? 'unknown';

    if (!sub || !email) return null;

    // Validate email format
    if (!email.includes('@')) return null;

    return {
      id: `user-${sub}`,
      email,
      name,
      provider,
    };
  } catch {
    return null;
  }
}

async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to confirm algorithm
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    return null;
  }

  if (header.alg !== 'HS256') {
    // NextAuth uses HS256 by default; reject other algorithms for safety
    return null;
  }

  // Import the secret key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch {
    return null;
  }

  // Verify signature
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = base64UrlToArrayBuffer(signatureB64);

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signature,
      encoder.encode(signingInput)
    );
  } catch {
    return null;
  }

  if (!valid) return null;

  // Decode payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }

  // Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return null;
  }

  return payload;
}

function base64UrlDecode(input: string): string {
  // Pad to multiple of 4
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const paddedStr = pad ? padded + '='.repeat(4 - pad) : padded;
  return atob(paddedStr);
}

function base64UrlToArrayBuffer(input: string): ArrayBuffer {
  const decoded = base64UrlDecode(input);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}
