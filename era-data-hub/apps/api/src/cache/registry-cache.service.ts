import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createHash } from "node:crypto";

@Injectable()
export class RegistryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RegistryCacheService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  private redis(): Redis | null {
    if (this.client) return this.client;
    const url = this.config.get<string>("REDIS_URL")?.trim();
    if (!url) return null;
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
      this.client.on("error", (e) =>
        this.logger.warn(`Redis: ${e instanceof Error ? e.message : String(e)}`),
      );
      return this.client;
    } catch (e) {
      this.logger.warn(
        `Redis connect skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  cacheKey(path: string, query: string): string {
    const h = createHash("sha256").update(`${path}?${query}`).digest("hex").slice(0, 16);
    return `registry:${path.replace(/\//g, ":")}:${h}`;
  }

  ttlForPath(path: string): number {
    const today = new Date().toISOString().slice(0, 10);
    if (path.includes("/fx/rates") && !path.includes("/range")) {
      return 300;
    }
    if (path.includes("/fx/rates/range")) {
      return 86_400;
    }
    if (path.includes("/calendar")) {
      return 86_400;
    }
    void today;
    return 3600;
  }

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const r = this.redis();
    if (!r) return null;
    try {
      if (r.status !== "ready") await r.connect();
      const raw = await r.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { body: string; etag: string };
      return parsed;
    } catch {
      return null;
    }
  }

  async set(key: string, body: string, ttlSec: number): Promise<string> {
    const etag = `"${createHash("md5").update(body).digest("hex")}"`;
    const r = this.redis();
    if (r) {
      try {
        if (r.status !== "ready") await r.connect();
        await r.setex(key, ttlSec, JSON.stringify({ body, etag }));
      } catch {
        /* ignore */
      }
    }
    return etag;
  }
}
