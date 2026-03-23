import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the infrastructure/db module before importing the rate-limit middleware
// ---------------------------------------------------------------------------
vi.mock('../../workers/infrastructure/db', () => ({
  getRateLimitCount: vi.fn(),
  incrementRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import * as db from '../../workers/infrastructure/db';
import { checkRateLimit } from '../../workers/middleware/rateLimit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDb = {} as D1Database;

function makeRequest(ip?: string): Request {
  const headers: Record<string, string> = {};
  if (ip) {
    headers['CF-Connecting-IP'] = ip;
  }
  return new Request('http://localhost/', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(0);
    vi.mocked(db.incrementRateLimit).mockResolvedValue(undefined);
  });

  it('returns true (allow) when request count is well under the 20/min limit', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(5);

    const result = await checkRateLimit(mockDb, makeRequest('1.2.3.4'));
    expect(result).toBe(true);
  });

  it('returns true (allow) when request count is 19 — one below the limit', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(19);

    const result = await checkRateLimit(mockDb, makeRequest('1.2.3.4'));
    expect(result).toBe(true);
  });

  it('returns false (block) when request count equals the limit (20)', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(20);

    const result = await checkRateLimit(mockDb, makeRequest('1.2.3.4'));
    expect(result).toBe(false);
  });

  it('returns false (block) when request count exceeds the limit', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(99);

    const result = await checkRateLimit(mockDb, makeRequest('1.2.3.4'));
    expect(result).toBe(false);
  });

  it('calls incrementRateLimit when request is within the limit', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(0);

    await checkRateLimit(mockDb, makeRequest('5.6.7.8'));

    expect(vi.mocked(db.incrementRateLimit)).toHaveBeenCalledWith(
      mockDb,
      'rl:5.6.7.8',
      expect.any(Number)
    );
  });

  it('does NOT call incrementRateLimit when request is blocked', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(20);

    await checkRateLimit(mockDb, makeRequest('5.6.7.8'));

    expect(vi.mocked(db.incrementRateLimit)).not.toHaveBeenCalled();
  });

  it('returns true (fail-open) when getRateLimitCount throws', async () => {
    vi.mocked(db.getRateLimitCount).mockRejectedValueOnce(new Error('DB unavailable'));

    const result = await checkRateLimit(mockDb, makeRequest('9.9.9.9'));
    expect(result).toBe(true);
  });

  it('returns true (fail-open) when incrementRateLimit throws', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(0);
    vi.mocked(db.incrementRateLimit).mockRejectedValueOnce(new Error('DB write error'));

    // The catch block in checkRateLimit only wraps both calls together,
    // so a throw from increment should also result in fail-open.
    const result = await checkRateLimit(mockDb, makeRequest('9.9.9.9'));
    expect(result).toBe(true);
  });

  it('uses X-Forwarded-For as fallback when CF-Connecting-IP is absent', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(0);

    const req = new Request('http://localhost/', {
      headers: { 'X-Forwarded-For': '10.0.0.1, 10.0.0.2' },
    });

    await checkRateLimit(mockDb, req);

    // Key should be built from the first IP in the X-Forwarded-For chain
    expect(vi.mocked(db.getRateLimitCount)).toHaveBeenCalledWith(mockDb, 'rl:10.0.0.1');
  });

  it('uses "unknown" as IP key when no IP header is present', async () => {
    vi.mocked(db.getRateLimitCount).mockResolvedValue(0);

    await checkRateLimit(mockDb, new Request('http://localhost/'));

    expect(vi.mocked(db.getRateLimitCount)).toHaveBeenCalledWith(mockDb, 'rl:unknown');
  });
});
