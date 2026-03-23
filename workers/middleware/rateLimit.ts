import { getRateLimitCount, incrementRateLimit } from '../infrastructure/db';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;

/**
 * Returns true if the request is within the rate limit, false if it should be blocked.
 * Fail-open: if the DB operation fails, allows the request through.
 */
export async function checkRateLimit(
  db: D1Database,
  request: Request
): Promise<boolean> {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  const key = `rl:${ip}`;

  try {
    const count = await getRateLimitCount(db, key);
    if (count >= MAX_REQUESTS) {
      return false;
    }

    const windowEnd = Date.now() + WINDOW_MS;
    await incrementRateLimit(db, key, windowEnd);
    return true;
  } catch {
    // Fail-open: allow request if DB is unavailable
    return true;
  }
}
