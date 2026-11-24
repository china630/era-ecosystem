import { prisma } from "@/lib/prisma";
import { addBakuDays, bakuDateKey, todayBakuYmd } from "@/lib/baku-day";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  buildProcedureLoadMatrix,
  clampLoadHorizonDays,
  type ProcedureLoadMatrix,
} from "@/domain/planning/procedure-load-matrix";

const LIVE = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "PENDING_PAY", "PROPOSED"] as const;

type CacheEntry = { at: number; topN: number; matrix: ProcedureLoadMatrix };
let memoryCache: CacheEntry | null = null;
const TTL_MS = 90_000;

export function invalidateProcedureLoadCache(): void {
  memoryCache = null;
}

export async function getProcedureLoadMatrix(opts?: {
  fromYmd?: string;
  toYmd?: string;
  topN?: number;
  bypassCache?: boolean;
}): Promise<ProcedureLoadMatrix> {
  const settings = await getSchedulingSettings();
  const horizon = clampLoadHorizonDays(settings.procedureLoadHorizonDays ?? 21, 21);
  const today = todayBakuYmd();
  const fromYmd = opts?.fromYmd ?? today;
  const toYmd = opts?.toYmd ?? addBakuDays(fromYmd, horizon - 1);
  const topN = opts?.topN ?? 10;

  if (!opts?.bypassCache && memoryCache && Date.now() - memoryCache.at < TTL_MS) {
    const m = memoryCache.matrix;
    if (m.fromYmd === fromYmd && m.toYmd === toYmd && memoryCache.topN === topN) return m;
  }

  const fromInstant = new Date(`${fromYmd}T00:00:00+04:00`);
  const toExclusive = new Date(`${addBakuDays(toYmd, 1)}T00:00:00+04:00`);

  const orders = await prisma.procedureOrder.findMany({
    where: {
      status: { in: [...LIVE] },
      cancelledAt: null,
      scheduledAt: { gte: fromInstant, lt: toExclusive },
      OR: [{ resourceId: { not: null } }, { status: "PROPOSED", inPackage: true }],
    },
    select: {
      procedureCode: true,
      procedureName: true,
      scheduledAt: true,
    },
  });

  const counts = new Map<string, Map<string, number>>();
  const names = new Map<string, string>();
  for (const row of orders) {
    const ymd = bakuDateKey(row.scheduledAt);
    names.set(row.procedureCode, row.procedureName || row.procedureCode);
    let byDay = counts.get(row.procedureCode);
    if (!byDay) {
      byDay = new Map();
      counts.set(row.procedureCode, byDay);
    }
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + 1);
  }

  const matrix = buildProcedureLoadMatrix({
    fromYmd,
    toYmd,
    horizonDays: horizon,
    counts,
    names,
    topN,
    nowYmd: today,
  });

  memoryCache = { at: Date.now(), topN, matrix };
  return matrix;
}
