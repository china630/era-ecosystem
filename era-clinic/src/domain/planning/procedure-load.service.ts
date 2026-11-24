import { prisma } from "@/lib/prisma";
import { addBakuDays, bakuDateKey, todayBakuYmd } from "@/lib/baku-day";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  buildProcedureLoadMatrix,
  clampLoadHorizonDays,
  estimateDayCapacity,
  type ProcedureLoadMatrix,
} from "@/domain/planning/procedure-load-matrix";

const LIVE = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "PENDING_PAY", "PROPOSED"] as const;

type CacheEntry = { at: number; topN: number; matrix: ProcedureLoadMatrix };
let memoryCache: CacheEntry | null = null;
const TTL_MS = 90_000;

export function invalidateProcedureLoadCache(): void {
  memoryCache = null;
}

async function dayCapacityByProcedureCodes(
  codes: string[],
  settings: Awaited<ReturnType<typeof getSchedulingSettings>>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;

  const types = await prisma.procedureType.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      durationMin: true,
      resourceCode: true,
      requirements: {
        where: { role: { in: ["LOCATION", "EQUIPMENT"] } },
        select: { resourceCode: true },
      },
    },
  });

  const resourceCodes = new Set<string>();
  const codesByType = new Map<string, string[]>();
  for (const pt of types) {
    const list = new Set<string>();
    for (const req of pt.requirements) {
      const c = req.resourceCode?.trim();
      if (c) list.add(c);
    }
    if (list.size === 0 && pt.resourceCode?.trim()) list.add(pt.resourceCode.trim());
    const arr = [...list];
    codesByType.set(pt.code, arr);
    for (const c of arr) resourceCodes.add(c);
  }

  const resources =
    resourceCodes.size > 0
      ? await prisma.resource.findMany({
          where: { code: { in: [...resourceCodes] } },
          select: { code: true, capacity: true },
        })
      : [];
  const capByCode = new Map(resources.map((r) => [r.code, Math.max(1, r.capacity || 1)]));

  for (const pt of types) {
    const listed = codesByType.get(pt.code) ?? [];
    let resourceCapacitySum = 0;
    for (const code of listed) resourceCapacitySum += capByCode.get(code) ?? 0;
    if (resourceCapacitySum < 1) resourceCapacitySum = 1;
    out.set(
      pt.code,
      estimateDayCapacity({
        dayStartHour: settings.dayStartHour,
        dayEndHour: settings.dayEndHour,
        lunchStartHour: settings.lunchStartHour,
        lunchEndHour: settings.lunchEndHour,
        durationMin: pt.durationMin,
        resourceCapacitySum,
      }),
    );
  }
  return out;
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

  const dayCapacityByCode = await dayCapacityByProcedureCodes([...counts.keys()], settings);

  const matrix = buildProcedureLoadMatrix({
    fromYmd,
    toYmd,
    horizonDays: horizon,
    counts,
    names,
    dayCapacityByCode,
    topN,
    nowYmd: today,
  });

  memoryCache = { at: Date.now(), topN, matrix };
  return matrix;
}
