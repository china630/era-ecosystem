import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/** Same window as the person snapshot. Writers delete the org set immediately. */
export const WORKFORCE_ROSTER_CACHE_TTL_SEC = 6 * 60 * 60;

export type RosterPreviewCell = {
  day: number;
  type: "WORK" | "OFF" | null;
  hours: number;
  placeId: string | null;
  placeCode: string | null;
  shiftTypeCode: string | null;
  fromOverride: boolean;
  conflict: boolean;
  conflictPlaces: string[];
};

export type RosterPreviewRow = {
  employmentId: string;
  staffCode: string;
  orgUnitId: string | null;
  globalPersonId: string;
  cells: RosterPreviewCell[];
};

export type RosterPreviewGap = {
  placeId: string;
  placeCode: string;
  placeName: string;
  days: number[];
};

export type RosterPreviewSnapshot = {
  year: number;
  month: number;
  lastDay: number;
  places: Array<{ id: string; code: string; name: string }>;
  rows: RosterPreviewRow[];
  gaps: RosterPreviewGap[];
};

function filterPart(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function previewKey(
  organizationId: string,
  year: number,
  month: number,
  placeId?: string,
  orgUnitId?: string,
): string {
  return `cache:wf:roster:${organizationId}:${year}:${month}:${filterPart(placeId)}:${filterPart(orgUnitId)}`;
}

function orgSetKey(organizationId: string): string {
  return `cache:wf:roster-org:${organizationId}`;
}

/**
 * Cached `previewMonth` grid (no person names).
 * Redis errors fall through to a live recompute.
 */
@Injectable()
export class WorkforceRosterCache implements OnModuleDestroy {
  private readonly logger = new Logger(WorkforceRosterCache.name);
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
        `roster cache: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async read(
    organizationId: string,
    year: number,
    month: number,
    opts?: { placeId?: string; orgUnitId?: string },
  ): Promise<RosterPreviewSnapshot | null> {
    try {
      const raw = await this.redis.get(
        previewKey(organizationId, year, month, opts?.placeId, opts?.orgUnitId),
      );
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RosterPreviewSnapshot;
      if (parsed?.year !== year || parsed?.month !== month) return null;
      return parsed;
    } catch (err) {
      this.logger.warn(
        `roster cache read failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async write(
    organizationId: string,
    snapshot: RosterPreviewSnapshot,
    opts?: { placeId?: string; orgUnitId?: string },
  ): Promise<void> {
    try {
      const key = previewKey(
        organizationId,
        snapshot.year,
        snapshot.month,
        opts?.placeId,
        opts?.orgUnitId,
      );
      const setKey = orgSetKey(organizationId);
      await this.redis
        .multi()
        .set(key, JSON.stringify(snapshot), "EX", WORKFORCE_ROSTER_CACHE_TTL_SEC)
        .sadd(setKey, key)
        .expire(setKey, WORKFORCE_ROSTER_CACHE_TTL_SEC)
        .exec();
    } catch (err) {
      this.logger.warn(
        `roster cache write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Drop every month and filter variant for the organization. */
  async forgetOrganization(organizationId: string): Promise<void> {
    try {
      const setKey = orgSetKey(organizationId);
      const keys = await this.redis.smembers(setKey);
      if (keys.length > 0) await this.redis.del(...keys);
      await this.redis.del(setKey);
    } catch (err) {
      this.logger.warn(
        `roster cache forget failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
