import { prisma } from "@/lib/prisma";
import { CLINIC_PRESET } from "@/domain/presets/clinic-presets";
import { listOverdueScheduledProcedures } from "@/domain/procedure/procedure-attendance.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { labOrderLaneWhere, loadDiagnosticLaneCodes, loadMenuSurfaceCodes } from "@/domain/lab/lab-order-lane";

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
  diagnostics: { open: number; resultReady: number };
  queue: { waiting: number; called: number };
  overdueProcedures: number;
  inpatient?: { occupiedBeds: number; freeBeds: number };
};

export async function getOpsDaySummary(
  dateYmd?: string,
  locale = "en",
  range?: { from?: string; to?: string },
): Promise<OpsDaySummary> {
  const fromYmd = (range?.from ?? dateYmd)?.trim() || todayBakuYmd();
  const toYmd = (range?.to ?? dateYmd)?.trim() || fromYmd;
  const date = toYmd;
  const { start } = bakuDayBounds(fromYmd <= toYmd ? fromYmd : toYmd);
  const { end } = bakuDayBounds(fromYmd <= toYmd ? toYmd : fromYmd);
  const dayFilter = { gte: start, lt: end };
  const diagnosticCodes = await loadDiagnosticLaneCodes();
  const surfaces = await loadMenuSurfaceCodes();
  const labLane =
    labOrderLaneWhere({
      kinds: ["lab_panel"],
      unclassified: true,
      diagnosticCodes,
      surfaceDiagnosticCodes: surfaces.diagnostic,
      surfaceLabCodes: surfaces.lab,
    }) ?? {};
  const diagnosticLane =
    labOrderLaneWhere({
      kinds: ["imaging", "functional", "endoscopy"],
      diagnosticCodes,
      surfaceDiagnosticCodes: surfaces.diagnostic,
      surfaceLabCodes: surfaces.lab,
    }) ?? {};

  const [
    appointmentGroups,
    procedureGroups,
    procedureTypeRows,
    visitsInProgress,
    visitsCompletedToday,
    labsOpen,
    labsResultReady,
    labsCompletedToday,
    diagnosticsOpen,
    diagnosticsResultReady,
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
      where: {
        status: { in: ["ORDERED", "COLLECTED", "IN_PROGRESS"] },
        ...labLane,
      },
    }),
    prisma.labOrder.count({ where: { status: "RESULT_READY", ...labLane } }),
    prisma.labOrder.count({
      where: {
        AND: [
          {
            status: { in: ["COMPLETED", "PUBLISHED"] },
            OR: [{ completedAt: dayFilter }, { publishedAt: dayFilter }],
          },
          labLane,
        ],
      },
    }),
    prisma.labOrder.count({
      where: {
        status: { in: ["ORDERED", "COLLECTED", "IN_PROGRESS"] },
        ...diagnosticLane,
      },
    }),
    prisma.labOrder.count({
      where: { status: "RESULT_READY", ...diagnosticLane },
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
    diagnostics: {
      open: diagnosticsOpen,
      resultReady: diagnosticsResultReady,
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
