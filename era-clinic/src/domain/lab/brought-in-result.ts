import { prisma } from "@/lib/prisma";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

const DAY_MS = 24 * 60 * 60 * 1000;

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
    if (service.broughtInMaxDays == null) continue;
    maxByCode.set(service.code, service.broughtInMaxDays);
    maxByCode.set(service.serviceCode, service.broughtInMaxDays);
  }
  const fresh = new Set<string>();
  for (const row of rows) {
    const maxDays = maxByCode.get(row.serviceCode);
    if (maxDays == null) continue;
    const ymd = row.resultOn.toISOString().slice(0, 10);
    if (broughtInIsFresh(ymd, maxDays)) fresh.add(row.serviceCode);
  }
  return fresh;
}
