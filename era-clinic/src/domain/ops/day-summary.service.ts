import { prisma } from "@/lib/prisma";
import { CLINIC_PRESET } from "@/domain/presets/clinic-presets";
import { listOverdueScheduledProcedures } from "@/domain/procedure/procedure-attendance.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

export { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

function countsByKey(
  rows: Array<{ status: string; _count: { _all: number } }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.status] = row._count._all;
  }
  return out;
}

export type OpsDaySummary = {
  date: string;
  appointments: { total: number; byStatus: Record<string, number> };
  procedures: {
    total: number;
    byStatus: Record<string, number>;
    byType: Array<{
      procedureTypeId: string | null;
      code: string;
      name: string;
      count: number;
    }>;
  };
  visits: { inProgress: number; completedToday: number };
  labs: { open: number; resultReady: number; completedToday: number };
  queue: { waiting: number; called: number };
  overdueProcedures: number;
  inpatient?: { occupiedBeds: number; freeBeds: number };
};

export async function getOpsDaySummary(
  dateYmd?: string,
  locale = "en",
): Promise<OpsDaySummary> {
  const date = dateYmd?.trim() || todayBakuYmd();
  const { start, end } = bakuDayBounds(date);
  const dayFilter = { gte: start, lt: end };

  const [
    appointmentGroups,
    procedureGroups,
    procedureTypeRows,
    visitsInProgress,
    visitsCompletedToday,
    labsOpen,
    labsResultReady,
    labsCompletedToday,
    queueWaiting,
    queueCalled,
    overdueRows,
    tenant,
  ] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { scheduledAt: dayFilter },
      _count: { _all: true },
    }),
    prisma.procedureOrder.groupBy({
      by: ["status"],
      where: { scheduledAt: dayFilter },
      _count: { _all: true },
    }),
    prisma.procedureOrder.groupBy({
      by: ["procedureTypeId", "procedureCode"],
      where: { scheduledAt: dayFilter },
      _count: { _all: true },
    }),
    prisma.visit.count({ where: { status: "IN_PROGRESS" } }),
    prisma.visit.count({
      where: {
        status: "COMPLETED",
        completedAt: dayFilter,
      },
    }),
    prisma.labOrder.count({
      where: { status: { in: ["ORDERED", "COLLECTED", "IN_PROGRESS"] } },
    }),
    prisma.labOrder.count({ where: { status: "RESULT_READY" } }),
    prisma.labOrder.count({
      where: {
        status: { in: ["COMPLETED", "PUBLISHED"] },
        OR: [{ completedAt: dayFilter }, { publishedAt: dayFilter }],
      },
    }),
    prisma.queueTicket.count({ where: { status: "WAITING" } }),
    prisma.queueTicket.count({ where: { status: "CALLED" } }),
    listOverdueScheduledProcedures(),
    prisma.tenant.findFirst({ select: { enabledPresets: true } }),
  ]);

  const appointmentByStatus = countsByKey(appointmentGroups);
  const procedureByStatus = countsByKey(procedureGroups);

  const { loadCatalogDisplayNameMap } = await import(
    "@/domain/catalog/catalog-display-name.service"
  );
  const catalogNames = await loadCatalogDisplayNameMap(
    procedureTypeRows.map((r) => r.procedureCode),
    locale,
  );

  const summary: OpsDaySummary = {
    date,
    appointments: {
      total: Object.values(appointmentByStatus).reduce((a, b) => a + b, 0),
      byStatus: appointmentByStatus,
    },
    procedures: {
      total: Object.values(procedureByStatus).reduce((a, b) => a + b, 0),
      byStatus: procedureByStatus,
      byType: [...procedureTypeRows]
        .sort((a, b) => b._count._all - a._count._all)
        .map((r) => ({
          procedureTypeId: r.procedureTypeId,
          code: r.procedureCode,
          name: catalogNames.get(r.procedureCode) || r.procedureCode,
          count: r._count._all,
        })),
    },
    visits: {
      inProgress: visitsInProgress,
      completedToday: visitsCompletedToday,
    },
    labs: {
      open: labsOpen,
      resultReady: labsResultReady,
      completedToday: labsCompletedToday,
    },
    queue: {
      waiting: queueWaiting,
      called: queueCalled,
    },
    overdueProcedures: overdueRows.length,
  };

  const presets = tenant?.enabledPresets ?? [];
  if (presets.includes(CLINIC_PRESET.INPATIENT_DAY)) {
    const [occupiedBeds, totalBeds] = await Promise.all([
      prisma.bedAssignment.count({ where: { dischargedAt: null } }),
      prisma.bed.count(),
    ]);
    summary.inpatient = {
      occupiedBeds,
      freeBeds: Math.max(0, totalBeds - occupiedBeds),
    };
  }

  return summary;
}
