import { prisma } from "@/lib/prisma";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Package blood panels stay in-house. The own-blank date is the infection panel. */
export const PACKAGE_BLOOD_BIOCHEM_CODES = new Set([
  "LAB-BIOCHEM-STANDART",
  "LAB-BIOCHEM-PREMIUM",
  "LAB-BIOCHEM-DERMA",
  "LAB-BIOCHEM-DETOKS",
]);

export function ownBlankMaxDays(code: string, days: number | null | undefined): number | null {
  if (days == null || PACKAGE_BLOOD_BIOCHEM_CODES.has(code)) return null;
  return days;
}

export function broughtInAgeDays(resultOnYmd: string, todayYmd = todayBakuYmd()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resultOnYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    return null;
  }
  const result = bakuDayBounds(resultOnYmd).start.getTime();
  const today = bakuDayBounds(todayYmd).start.getTime();
  return Math.round((today - result) / DAY_MS);
}

export function broughtInIsFresh(resultOnYmd: string, maxDays: number, todayYmd = todayBakuYmd()): boolean {
  const age = broughtInAgeDays(resultOnYmd, todayYmd);
  return age != null && age >= 0 && age <= maxDays;
}

export async function freshBroughtInCodes(episodeId: string): Promise<Set<string>> {
  const rows = await prisma.episodeBroughtInResult.findMany({
    where: { episodeId },
    select: { serviceCode: true, resultOn: true },
  });
  if (rows.length === 0) return new Set();
  const services = await prisma.diagnosticService.findMany({
    where: {
      broughtInMaxDays: { not: null },
      OR: [
        { code: { in: rows.map((row) => row.serviceCode) } },
        { serviceCode: { in: rows.map((row) => row.serviceCode) } },
      ],
    },
    select: { code: true, serviceCode: true, broughtInMaxDays: true },
  });
  const maxByCode = new Map<string, number>();
  for (const service of services) {
    const days = ownBlankMaxDays(service.code, service.broughtInMaxDays);
    if (days == null) continue;
    maxByCode.set(service.code, days);
    const viaSku = ownBlankMaxDays(service.serviceCode, service.broughtInMaxDays);
    if (viaSku != null) maxByCode.set(service.serviceCode, viaSku);
  }
  const fresh = new Set<string>();
  for (const row of rows) {
    const maxDays = maxByCode.get(row.serviceCode);
    if (maxDays == null) continue;
    const ymd = row.resultOn.toISOString().slice(0, 10);
    if (!broughtInIsFresh(ymd, maxDays)) continue;
    fresh.add(row.serviceCode);
    for (const service of services) {
      if (service.code !== row.serviceCode && service.serviceCode !== row.serviceCode) continue;
      fresh.add(service.code);
      if (service.serviceCode) fresh.add(service.serviceCode);
    }
  }
  return fresh;
}
