/**
 * RateLimiter Durable Object
 *
 * Each instance handles one key (e.g. one IP address).
 * State is kept in-memory — fast, consistent, and evicted when idle.
 *
 * Protocol: POST the DO stub with JSON { limit: number, windowMs: number }
 * Response: { allowed: boolean, remaining: number, resetAt: number }
 */
export class RateLimiter {
  private count = 0;
  private resetAt = 0;

  async fetch(request: Request): Promise<Response> {
    const body = await request.json<{ limit: number; windowMs: number }>();
    const { limit, windowMs } = body;

    const now = Date.now();

    if (now >= this.resetAt) {
      this.count = 0;
      this.resetAt = now + windowMs;
    }

    if (this.count >= limit) {
      return Response.json({ allowed: false, remaining: 0, resetAt: this.resetAt });
    }

    this.count++;
    return Response.json({
      allowed: true,
      remaining: limit - this.count,
      resetAt: this.resetAt,
    });
  }
}
