import type { ConnectionOptions } from "bullmq";

export function connectionFromRedisUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.replace("/", "")) || 0 : 0,
    maxRetriesPerRequest: null,
  };
}
