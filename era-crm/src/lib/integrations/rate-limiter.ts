/**
 * Token-bucket rate limiter (TZ T-I06). Uses Redis when REDIS_URL is set;
 * otherwise an in-process bucket (single Nest instance).
 */
type Bucket = { tokens: number; updatedAt: number };

const memory = new Map<string, Bucket>();

export async function checkRateLimit(
  key: string,
  perSecond: number,
): Promise<boolean> {
  const rate = Math.max(1, perSecond);
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    try {
      const Redis = (await import("ioredis")).default;
      const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      await redis.connect();
      const redisKey = `crm:rl:${key}`;
      const n = await redis.incr(redisKey);
      if (n === 1) await redis.expire(redisKey, 1);
      await redis.quit();
      return n <= rate;
    } catch {
      /* fall through to memory */
    }
  }
  const now = Date.now();
  const b = memory.get(key) ?? { tokens: rate, updatedAt: now };
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(rate, b.tokens + elapsed * rate);
  b.updatedAt = now;
  if (b.tokens < 1) {
    memory.set(key, b);
    return false;
  }
  b.tokens -= 1;
  memory.set(key, b);
  return true;
}
