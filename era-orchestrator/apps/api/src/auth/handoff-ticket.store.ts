import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const KEY_PREFIX = "finance-handoff:";
const TTL_SEC = 60;

export type HandoffTicketPayload = {
  userId: string;
  organizationId: string | null;
};

/**
 * One-time Finance handoff tickets in Redis so tickets survive Orchestrator
 * process restarts (in-memory Map did not).
 */
@Injectable()
export class HandoffTicketStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HandoffTicketStore.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>("REDIS_URL", "redis://127.0.0.1:6379");
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.log("Redis connected for finance handoff tickets");
    } catch (err) {
      this.logger.error(
        `Redis connect failed for handoff tickets: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async put(ticket: string, payload: HandoffTicketPayload): Promise<void> {
    if (!payload.userId || payload.userId.length < 10) {
      throw new UnauthorizedException("Invalid handoff user");
    }
    await this.redis.set(
      `${KEY_PREFIX}${ticket}`,
      JSON.stringify({
        userId: payload.userId,
        organizationId: payload.organizationId || null,
      }),
      "EX",
      TTL_SEC,
    );
  }

  /** Atomically read + delete (one-time use). */
  async take(ticket: string): Promise<HandoffTicketPayload> {
    if (!ticket?.startsWith("fh_")) {
      throw new UnauthorizedException("Handoff ticket invalid or expired");
    }
    const key = `${KEY_PREFIX}${ticket}`;
    const raw =
      typeof this.redis.getdel === "function"
        ? await this.redis.getdel(key)
        : await this.getAndDelete(key);
    if (!raw) {
      throw new UnauthorizedException("Handoff ticket invalid or expired");
    }
    try {
      const parsed = JSON.parse(raw) as HandoffTicketPayload;
      if (!parsed?.userId || parsed.userId.length < 10) {
        throw new UnauthorizedException("Handoff ticket invalid or expired");
      }
      const organizationId =
        parsed.organizationId && parsed.organizationId.length > 10
          ? parsed.organizationId
          : null;
      return {
        userId: parsed.userId,
        organizationId,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException("Handoff ticket invalid or expired");
    }
  }

  private async getAndDelete(key: string): Promise<string | null> {
    const raw = await this.redis.get(key);
    if (raw) await this.redis.del(key);
    return raw;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
