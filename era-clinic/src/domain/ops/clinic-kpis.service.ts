import { prisma } from "@/lib/prisma";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

export type ClinicKpis = {
  from: string;
  to: string;
  appointments: {
    total: number;
    noShow: number;
    noShowRate: number | null;
    checkedIn: number;
    completed: number;
  };
};

export async function computeClinicKpis(range?: { from?: string; to?: string }): Promise<ClinicKpis> {
  const fromYmd = range?.from?.trim() || todayBakuYmd();
  const toYmd = range?.to?.trim() || fromYmd;
  const { start } = bakuDayBounds(fromYmd <= toYmd ? fromYmd : toYmd);
  const { end } = bakuDayBounds(fromYmd <= toYmd ? toYmd : fromYmd);
  const dayFilter = { gte: start, lt: end };

  const groups = await prisma.appointment.groupBy({
    by: ["status"],
    where: { scheduledAt: dayFilter },
    _count: { _all: true },
  });

  const byStatus: Record<string, number> = {};
  for (const g of groups) byStatus[g.status] = g._count._all;

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const noShow = byStatus.NO_SHOW ?? 0;
  const denominator = total - (byStatus.CANCELLED ?? 0);
  const noShowRate = denominator > 0 ? Math.round((noShow / denominator) * 1000) / 1000 : null;

  return {
    from: fromYmd <= toYmd ? fromYmd : toYmd,
    to: fromYmd <= toYmd ? toYmd : fromYmd,
    appointments: {
      total,
      noShow,
      noShowRate,
      checkedIn: byStatus.CHECKED_IN ?? 0,
      completed: byStatus.COMPLETED ?? 0,
    },
  };
}