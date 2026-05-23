import { createClient, type RedisClientType } from 'redis';

const globalForRedis = globalThis as unknown as { redis: RedisClientType | null };

export async function getRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!globalForRedis.redis) {
    const client = createClient({ url });
    client.on('error', (err) => console.error('Redis error', err));
    await client.connect();
    globalForRedis.redis = client as RedisClientType;
  }
  return globalForRedis.redis;
}

export const OUTBOUND_RETRY_QUEUE = 'outbound:retry';
export const IDEMPOTENCY_PREFIX = 'outbound:sent:';
