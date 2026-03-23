import type { Env } from '../index';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;

/**
 * Returns true if the request is within the rate limit, false if it should be blocked.
 * Uses a Durable Object (RateLimiter) for consistent, low-latency counting.
 * Fail-open: allows request through if the DO is unavailable.
 */
export async function checkRateLimit(
  env: Env,
  request: Request
): Promise<boolean> {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  try {
    const id = env.RATE_LIMITER.idFromName(ip);
    const stub = env.RATE_LIMITER.get(id);

    const response = await stub.fetch('https://internal/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: MAX_REQUESTS, windowMs: WINDOW_MS }),
    });

    const result = await response.json<{ allowed: boolean }>();
    return result.allowed;
  } catch {
    // Fail-open: allow request if DO is unavailable
    return true;
  }
}
