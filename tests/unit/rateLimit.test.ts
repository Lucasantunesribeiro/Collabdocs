import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit } from '../../workers/middleware/rateLimit';
import type { Env } from '../../workers/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(stubResponse: { allowed: boolean; remaining?: number; resetAt?: number }): Env {
  const stub = {
    fetch: vi.fn().mockResolvedValue(
      new Response(JSON.stringify(stubResponse), {
        headers: { 'Content-Type': 'application/json' },
      })
    ),
  };
  return {
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue('fake-id'),
      get: vi.fn().mockReturnValue(stub),
    },
  } as unknown as Env;
}

function makeRequest(ip?: string): Request {
  const headers: Record<string, string> = {};
  if (ip) headers['CF-Connecting-IP'] = ip;
  return new Request('http://localhost/', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkRateLimit (Durable Object)', () => {
  it('returns true when DO responds { allowed: true }', async () => {
    const env = makeEnv({ allowed: true, remaining: 19 });
    const result = await checkRateLimit(env, makeRequest('1.2.3.4'));
    expect(result).toBe(true);
  });

  it('returns false when DO responds { allowed: false }', async () => {
    const env = makeEnv({ allowed: false, remaining: 0 });
    const result = await checkRateLimit(env, makeRequest('1.2.3.4'));
    expect(result).toBe(false);
  });

  it('uses idFromName with the CF-Connecting-IP header', async () => {
    const env = makeEnv({ allowed: true });
    await checkRateLimit(env, makeRequest('5.6.7.8'));
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith('5.6.7.8');
  });

  it('uses "unknown" as key when no IP header is present', async () => {
    const env = makeEnv({ allowed: true });
    await checkRateLimit(env, new Request('http://localhost/'));
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith('unknown');
  });

  it('uses X-Forwarded-For first IP when CF-Connecting-IP is absent', async () => {
    const env = makeEnv({ allowed: true });
    const req = new Request('http://localhost/', {
      headers: { 'X-Forwarded-For': '10.0.0.1, 10.0.0.2' },
    });
    await checkRateLimit(env, req);
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith('10.0.0.1');
  });

  it('fails open (returns true) when DO fetch throws', async () => {
    const stub = { fetch: vi.fn().mockRejectedValue(new Error('DO unavailable')) };
    const env = {
      RATE_LIMITER: {
        idFromName: vi.fn().mockReturnValue('fake-id'),
        get: vi.fn().mockReturnValue(stub),
      },
    } as unknown as Env;

    const result = await checkRateLimit(env, makeRequest('9.9.9.9'));
    expect(result).toBe(true);
  });

  it('sends the correct limit and windowMs in the POST body', async () => {
    const stub = {
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ allowed: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    };
    const env = {
      RATE_LIMITER: { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) },
    } as unknown as Env;

    await checkRateLimit(env, makeRequest('1.1.1.1'));

    const [, init] = stub.fetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.limit).toBe(20);
    expect(body.windowMs).toBe(60_000);
  });
});
