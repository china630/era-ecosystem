import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/** Six hours. A missed invalidation still drops the snapshot. */
export const WORKFORCE_PERSON_CACHE_TTL_SEC = 6 * 60 * 60;

export type WorkforcePersonCacheRow = {
  globalPersonId: string;
  displayName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  primaryIdentifierMasked: string | null;
  accessDenied: boolean;
  sex: string | null;
  birthDate: string | null;
};

function personKey(personId: string, organizationId: string): string {
  return `cache:wf:person:${personId}:${organizationId}`;
}

function orgSetKey(personId: string): string {
  return `cache:wf:person-orgs:${personId}`;
}

function aliasSetKey(personId: string): string {
  return `cache:wf:person-alias:${personId}`;
}

/**
 * Compact workforce display for one person and one organization.
 * HR profile (addresses, blood group) is not stored.
 * Redis errors fall through so a timesheet still loads from MDM.
 */
@Injectable()
export class MdmPersonCache implements OnModuleDestroy {
  private readonly logger = new Logger(MdmPersonCache.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>("REDIS_URL", "redis://127.0.0.1:6379");
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    this.redis.on("error", (err) => {
      this.logger.warn(
        `person cache: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async read(
    organizationId: string,
    personIds: string[],
  ): Promise<Map<string, WorkforcePersonCacheRow>> {
    const out = new Map<string, WorkforcePersonCacheRow>();
    if (personIds.length === 0) return out;
    try {
      const keys = personIds.map((id) => personKey(id, organizationId));
      const raw = await this.redis.mget(...keys);
      for (let i = 0; i < personIds.length; i++) {
        const text = raw[i];
        if (!text) continue;
        try {
          const row = JSON.parse(text) as WorkforcePersonCacheRow;
          if (row?.globalPersonId) out.set(personIds[i], row);
        } catch {
          // One corrupt value must not drop the rest of the batch.
        }
      }
    } catch (err) {
      this.logger.warn(
        `person cache read failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return out;
  }

  async write(
    organizationId: string,
    personId: string,
    row: WorkforcePersonCacheRow,
    aliasId?: string,
  ): Promise<void> {
    try {
      const key = personKey(personId, organizationId);
      const setKey = orgSetKey(personId);
      const multi = this.redis
        .multi()
        .set(key, JSON.stringify(row), "EX", WORKFORCE_PERSON_CACHE_TTL_SEC)
        .sadd(setKey, organizationId)
        .expire(setKey, WORKFORCE_PERSON_CACHE_TTL_SEC);
      if (aliasId && aliasId !== personId) {
        multi
          .set(
            personKey(aliasId, organizationId),
            JSON.stringify(row),
            "EX",
            WORKFORCE_PERSON_CACHE_TTL_SEC,
          )
          .sadd(orgSetKey(aliasId), organizationId)
          .expire(orgSetKey(aliasId), WORKFORCE_PERSON_CACHE_TTL_SEC)
          .sadd(aliasSetKey(personId), aliasId)
          .expire(aliasSetKey(personId), WORKFORCE_PERSON_CACHE_TTL_SEC);
      }
      await multi.exec();
    } catch (err) {
      this.logger.warn(
        `person cache write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Drop one org, or every org that holds a snapshot of this person (and merged aliases). */
  async forget(personId: string, organizationId?: string): Promise<void> {
    try {
      const aliases = await this.redis.smembers(aliasSetKey(personId));
      const ids = [personId, ...aliases.filter((id) => id !== personId)];
      for (const id of ids) {
        const setKey = orgSetKey(id);
        if (organizationId) {
          await this.redis.del(personKey(id, organizationId));
          await this.redis.srem(setKey, organizationId);
          continue;
        }
        const orgs = await this.redis.smembers(setKey);
        const keys = orgs.map((org) => personKey(id, org));
        if (keys.length > 0) await this.redis.del(...keys);
        await this.redis.del(setKey);
      }
      if (!organizationId) await this.redis.del(aliasSetKey(personId));
    } catch (err) {
      this.logger.warn(
        `person cache forget failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
