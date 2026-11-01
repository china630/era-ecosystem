import { prisma } from "@/lib/prisma";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import { loadCatalogDisplayNameMap } from "@/domain/catalog/catalog-display-name.service";
import type { DiagnosticCatalogItem, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { hasCriticalFlag, type ResultLineInput } from "@/lib/lab-result-flags";
import { getClinicSettings } from "@/domain/settings/settings.service";
import { showsUnpaidExtraOnPlan } from "@/domain/sanatorium/extra-procedure-route";
import {
  bakuDateKey,
  mergeAppointmentVisitEvents,
  type PatientTimelineDay,
  type PatientTimelineEvent,
  type TimelineEventType,
} from "@/domain/patient/patient-timeline.service";
import {
  PROCEDURE_PHYSIO_INCLUDE,
  toPhysioOrderPayload,
} from "@/domain/physio/physio-order-sites.service";
import { getIntakeChecklist } from "@/domain/patient/intake-checklist.service";
import { bakuDateTimeLabel, bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintLang } from "@/domain/print/print-types";
import { labOrderVisibleToLabWhere } from "@/domain/lab/lab-order-pay-gate";
import { listPendingDiagnostics } from "@/domain/sanatorium/diagnostics-extras.service";

const RESULT_STATUSES = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);
const PENDING_LAB_STATUSES = new Set(["ORDERED", "COLLECTED", "IN_PROGRESS"]);

function parseResultLines(resultJson: string | null): ResultLineInput[] {
  if (!resultJson) return [];
  try {
    const parsed = JSON.parse(resultJson) as ResultLineInput[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function labCatalog(
  testCode: string,
  catalogItems: DiagnosticCatalogItem[],
): { title: string; titleL10n?: L10n; kind: string | null } {
  const primary = testCode.split(",")[0]?.trim() ?? testCode;
  const item = catalogItems.find((i) => i.code === primary || i.serviceCode === primary);
  if (!item) return { title: testCode, kind: null };
  return { title: `${item.title.en} (${testCode})`, titleL10n: item.title, kind: item.kind };
}

const IMAGING_KINDS = new Set(["imaging", "functional", "endoscopy"]);

function matchesLabCatalogKind(
  testCode: string,
  catalogItems: DiagnosticCatalogItem[],
  labCatalogKind: "panel" | "imaging",
): boolean {
  const { kind } = labCatalog(testCode, catalogItems);
  const isImaging = Boolean(kind && IMAGING_KINDS.has(kind));
  if (labCatalogKind === "imaging") return isImaging;
  // panel: lab_panel or unknown/missing kind
  return !isImaging;
}

function mapLabEvent(
  o: {
    id: string;
    testCode: string;
    status: string;
    amountNet: { toString(): string };
    resultJson: string | null;
    publishedAt: Date | null;
    completedAt: Date | null;
    collectedAt: Date | null;
    createdAt: Date;
  },
  catalogItems: DiagnosticCatalogItem[],
): PatientTimelineEvent {
  const at = (
    o.publishedAt ??
    o.completedAt ??
    o.collectedAt ??
    o.createdAt
  ).toISOString();
  const lines = parseResultLines(o.resultJson);
  const codes = o.testCode.split(",").map((c) => c.trim()).filter(Boolean);
  const catalog = labCatalog(o.testCode, catalogItems);
  return {
    id: `lab_order:${o.id}`,
    type: "lab_order",
    at,
    title: catalog.title,
    titleL10n: catalog.titleL10n,
    subtitle: RESULT_STATUSES.has(o.status)
      ? lines.length
        ? `${lines.length} result line(s)`
        : o.testCode
      : o.testCode,
    status: o.status,
    href: `/lab-orders/${o.id}`,
    codes,
    amountNet: o.amountNet.toString(),
    hasCritical: lines.length ? hasCriticalFlag(lines) : false,
    resultSummary: lines.slice(0, 8).map((l) => ({
      code: l.code,
      value: l.value,
      flag: l.flag,
    })),
  };
}

function withTimeSubtitle(ev: PatientTimelineEvent): PatientTimelineEvent {
  if (ev.openAttendance) return ev;
  if (ev.showClock === false) return ev;
  return {
    ...ev,
    subtitle: ev.subtitle
      ? `${bakuDateTimeLabel(ev.at)} · ${ev.subtitle}`
      : bakuDateTimeLabel(ev.at),
  };
}

function mapProcedureEvent(p: {
  id: string;
  scheduledAt: Date;
  resourceId?: string | null;
  schedulingMode?: string | null;
  procedureName: string;
  procedureCode: string;
  status: string;
  bodyPart: string | null;
  note: string | null;
  siteApplyMode: "TOGETHER" | "TURN" | null;
  physioFields?: unknown;
  amountNet: { toString(): string };
  procedureType?: {
    needsSite: boolean;
    physioOrderFields?: string[];
    allowedSiteCodes?: string[];
    code?: string;
    name?: string;
  } | null;
  sites: Array<{ siteId: string; laterality?: "LEFT" | "RIGHT" | "BOTH" | null }>;
}): PatientTimelineEvent {
  const siteCodes = p.sites.length ? `${p.sites.length} S` : null;
  const openUnseated = p.schedulingMode === "OPEN" && !p.resourceId;
  return {
    id: `procedure:${p.id}`,
    type: "procedure",
    at: p.scheduledAt.toISOString(),
    showClock:
      !openUnseated && (p.status !== "PENDING_PAY" || Boolean(p.resourceId)),
    openAttendance: openUnseated,
    title: `Procedure · ${p.procedureName}`,
    subtitle: [p.procedureCode ? `type ${p.procedureCode}` : null, siteCodes, p.bodyPart]
      .filter(Boolean)
      .join(" · "),
    status: p.status,
    codes: [p.procedureCode],
    amountNet: p.amountNet.toString(),
    physio: toPhysioOrderPayload(p),
  };
}

function groupDays(
  events: PatientTimelineEvent[],
  order: "history" | "plan" = "history",
): PatientTimelineDay[] {
  const dayMap = new Map<string, PatientTimelineEvent[]>();
  for (const ev of events) {
    const key = bakuDateKey(ev.at);
    const list = dayMap.get(key) ?? [];
    list.push(withTimeSubtitle(ev));
    dayMap.set(key, list);
  }
  const todayKey = bakuDateKey(new Date());
  const keys = [...dayMap.keys()];
  const sortedKeys =
    order === "plan"
      ? keys.sort((a, b) => a.localeCompare(b))
      : [
          ...keys.filter((d) => d >= todayKey).sort((a, b) => a.localeCompare(b)),
          ...keys.filter((d) => d < todayKey).sort((a, b) => b.localeCompare(a)),
        ];
  return sortedKeys.map((date) => ({
    date,
    labelHint: date === todayKey ? "today" : date > todayKey ? "upcoming" : "past",
    events: (dayMap.get(date) ?? []).sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    ),
  }));
}

export async function getPatientCardSummary(
  patientRefId: string,
  opts?: { episodeId?: string | null; locale?: string },
) {
  const [settings, catalog] = await Promise.all([getClinicSettings(), getDiagnosticCatalog()]);
  const now = new Date();
  const todayBounds = bakuDayBounds(todayBakuYmd(now));

  const activeEpisode = opts?.episodeId
    ? await prisma.clinicalEpisode.findFirst({
        where: { id: opts.episodeId, patientRefId },
      })
    : await prisma.clinicalEpisode.findFirst({
        where: { patientRefId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });

  const checklistEpisodeId = opts?.episodeId ?? activeEpisode?.id ?? null;
  const episodeFilter = checklistEpisodeId
    ? { clinicalEpisodeId: checklistEpisodeId }
    : opts?.episodeId
      ? { clinicalEpisodeId: opts.episodeId }
      : {};

  const [
    nextAppointment,
    nextProcedure,
    pendingLabs,
    resultLabs,
    upcomingProcedures,
    proposedProcedures,
    pendingExtras,
    intakeChecklist,
    examNotes,
  ] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        patientRefId,
        scheduledAt: { gte: now },
        status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] },
      },
      include: { practitioner: { select: { fullName: true, code: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.procedureOrder.findFirst({
      where: {
        patientRefId,
        ...episodeFilter,
        scheduledAt: { gte: now },
        status: { in: ["SCHEDULED", "CHECKED_IN"] as ("SCHEDULED" | "CHECKED_IN")[] },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.labOrder.findMany({
      where: {
        patientRefId,
        ...episodeFilter,
        status: { in: ["ORDERED", "COLLECTED", "IN_PROGRESS"] },
        AND: [labOrderVisibleToLabWhere()],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.labOrder.findMany({
      where: {
        patientRefId,
        ...episodeFilter,
        status: { in: ["RESULT_READY", "PUBLISHED", "COMPLETED"] },
        AND: [labOrderVisibleToLabWhere()],
        OR: [
          { items: { some: { results: { some: {} } } } },
          { AND: [{ resultJson: { not: null } }, { NOT: { resultJson: { in: ["", "[]"] } } }] },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { completedAt: "desc" }, { createdAt: "desc" }],
      take: settings.patientCardResultsPreview,
    }),
    prisma.procedureOrder.findMany({
      where: {
        patientRefId,
        ...episodeFilter,
        scheduledAt: { gte: todayBounds.start, lt: todayBounds.end },
        status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED"] },
      },
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.procedureOrder.findMany({
      where: {
        patientRefId,
        ...episodeFilter,
        status: "PROPOSED",
      },
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      take: settings.patientCardPlanPreview,
    }),
    prisma.procedureOrder.findMany({
      where: {
        patientRefId,
        ...episodeFilter,
        status: "PENDING_PAY",
        inPackage: false,
      },
      orderBy: { scheduledAt: "asc" },
      take: 40,
    }),
    getIntakeChecklist(patientRefId, { episodeId: checklistEpisodeId }),
    prisma.cpoeEntry.findMany({
      where: {
        visit: {
          patientRefId,
          ...(checklistEpisodeId ? { clinicalEpisodeId: checklistEpisodeId } : {}),
        },
      },
      include: {
        visit: { select: { id: true, practitioner: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: settings.patientCardResultsPreview,
    }),
  ]);

  const catalogNames = await loadCatalogDisplayNameMap(
    [
      nextProcedure?.procedureCode,
      ...upcomingProcedures.map((row) => row.procedureCode),
      ...proposedProcedures.map((row) => row.procedureCode),
      ...pendingExtras.map((row) => row.procedureCode),
    ].filter((code): code is string => Boolean(code)),
    opts?.locale ?? "az",
  );
  const displayProcedureName = (code: string, stored: string) =>
    catalogNames.get(code) || stored;

  const pendingDiagnostics = checklistEpisodeId
    ? await listPendingDiagnostics(checklistEpisodeId)
    : [];

  const paidExtraOrders = checklistEpisodeId
    ? await prisma.procedureOrder.findMany({
        where: {
          clinicalEpisodeId: checklistEpisodeId,
          inPackage: false,
          status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
          amountNet: { gt: 0 },
        },
        select: {
          procedureCode: true,
          procedureName: true,
          status: true,
          amountNet: true,
        },
      })
    : [];
  const paidLabExtras = checklistEpisodeId
    ? await prisma.labOrder.findMany({
        where: {
          clinicalEpisodeId: checklistEpisodeId,
          inPackage: false,
          amountNet: { gt: 0 },
          settledAt: { not: null },
          status: { not: "CANCELLED" },
        },
        select: {
          testCode: true,
          status: true,
          amountNet: true,
          items: {
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: {
              serviceCode: true,
              diagnosticService: {
                select: { titleAz: true, titleRu: true, titleEn: true, code: true },
              },
            },
          },
        },
      })
    : [];
  const paidVisitExtras = checklistEpisodeId
    ? await prisma.visit.findMany({
        where: {
          clinicalEpisodeId: checklistEpisodeId,
          amountNet: { gt: 0 },
          settledAt: { not: null },
          status: { not: "CANCELLED" },
          NOT: { serviceLines: { some: { inPackage: true } } },
        },
        select: {
          status: true,
          amountNet: true,
          serviceLines: {
            orderBy: { id: "asc" },
            take: 1,
            select: { serviceCode: true, description: true },
          },
        },
      })
    : [];

  type ScaleAgg = {
    code: string;
    title: string;
    assigned: number;
    completed: number;
    amountNet: number;
  };
  const paidExtrasByCode = new Map<string, ScaleAgg>();
  for (const row of paidExtraOrders) {
    const code = row.procedureCode;
    const cur = paidExtrasByCode.get(code) ?? {
      code,
      title: displayProcedureName(code, row.procedureName),
      assigned: 0,
      completed: 0,
      amountNet: 0,
    };
    cur.assigned += 1;
    if (row.status === "COMPLETED" || row.status === "CHECKED_IN") cur.completed += 1;
    cur.amountNet += Number(row.amountNet || 0);
    paidExtrasByCode.set(code, cur);
  }
  const paidDiagnosticsByCode = new Map<string, ScaleAgg>();
  const labDone = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);
  const localeKey = (opts?.locale ?? "az").toLowerCase();
  const pickDiagTitle = (
    svc:
      | { titleAz: string | null; titleRu: string | null; titleEn: string | null; code: string }
      | null
      | undefined,
    fallback: string,
  ) => {
    if (!svc) return fallback;
    const az = svc.titleAz?.trim() || "";
    const ru = svc.titleRu?.trim() || "";
    const en = svc.titleEn?.trim() || "";
    if (localeKey.startsWith("ru")) return ru || az || en || fallback;
    if (localeKey.startsWith("en")) return en || az || ru || fallback;
    return az || ru || en || fallback;
  };
  for (const row of paidLabExtras) {
    const item = row.items[0];
    const code = item?.serviceCode || row.testCode.split(",")[0] || row.testCode;
    const cur = paidDiagnosticsByCode.get(code) ?? {
      code,
      title: pickDiagTitle(item?.diagnosticService, code),
      assigned: 0,
      completed: 0,
      amountNet: 0,
    };
    cur.assigned += 1;
    if (labDone.has(row.status)) cur.completed += 1;
    cur.amountNet += Number(row.amountNet || 0);
    paidDiagnosticsByCode.set(code, cur);
  }
  for (const row of paidVisitExtras) {
    const line = row.serviceLines[0];
    const code = line?.serviceCode || "VISIT";
    const cur = paidDiagnosticsByCode.get(code) ?? {
      code,
      title: line?.description || code,
      assigned: 0,
      completed: 0,
      amountNet: 0,
    };
    cur.assigned += 1;
    if (row.status === "COMPLETED") cur.completed += 1;
    cur.amountNet += Number(row.amountNet || 0);
    paidDiagnosticsByCode.set(code, cur);
  }

  return {
    patientRefId,
    limits: {
      resultsPreview: settings.patientCardResultsPreview,
      planPreview: settings.patientCardPlanPreview,
      historyPageSize: settings.patientCardHistoryPageSize,
      planPageSize: settings.patientCardPlanPageSize,
    },
    nowNext: {
      nextAppointment: nextAppointment
        ? {
            id: nextAppointment.id,
            at: nextAppointment.scheduledAt.toISOString(),
            atLabel: bakuDateTimeLabel(nextAppointment.scheduledAt),
            status: nextAppointment.status,
            practitionerName: nextAppointment.practitioner.fullName,
            roomCode: nextAppointment.roomCode,
            href: "/appointments",
          }
        : null,
      activeEpisode: activeEpisode
        ? {
            id: activeEpisode.id,
            status: activeEpisode.status,
            programCode: activeEpisode.programCode,
            roomNumber: activeEpisode.roomNumber,
            openedAt: activeEpisode.openedAt.toISOString(),
            href: `/sanatorium?episode=${activeEpisode.id}`,
          }
        : null,
      nextProcedure: nextProcedure
        ? {
            id: nextProcedure.id,
            at: nextProcedure.scheduledAt.toISOString(),
            atLabel:
              nextProcedure.schedulingMode === "OPEN" && !nextProcedure.resourceId
                ? printLabel(
                    (opts?.locale === "en" || opts?.locale === "ru" || opts?.locale === "az"
                      ? opts.locale
                      : "az") as PrintLang,
                    "openAttendance",
                  )
                : bakuDateTimeLabel(nextProcedure.scheduledAt),
            openAttendance:
              nextProcedure.schedulingMode === "OPEN" && !nextProcedure.resourceId,
            name: displayProcedureName(
              nextProcedure.procedureCode,
              nextProcedure.procedureName,
            ),
            code: nextProcedure.procedureCode,
            status: nextProcedure.status,
          }
        : null,
      pendingLabs: {
        count: pendingLabs.length,
        items: pendingLabs.slice(0, 5).map((o) => mapLabEvent(o, catalog.items)),
      },
    },
    resultsPreview: resultLabs.map((o) => mapLabEvent(o, catalog.items)).map(withTimeSubtitle),
    planPreview: upcomingProcedures.map((p) =>
      withTimeSubtitle(
        mapProcedureEvent({
          ...p,
          procedureName: displayProcedureName(p.procedureCode, p.procedureName),
        }),
      ),
    ),
    proposedPreview: proposedProcedures.map((p) =>
      withTimeSubtitle(
        mapProcedureEvent({
          ...p,
          procedureName: displayProcedureName(p.procedureCode, p.procedureName),
        }),
      ),
    ),
    pendingExtras: pendingExtras.map((p) => ({
      id: p.id,
      title: displayProcedureName(p.procedureCode, p.procedureName),
      code: p.procedureCode,
      amountNet: Number(p.amountNet ?? 0),
      status: p.status,
    })),
    pendingDiagnostics: pendingDiagnostics.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      code: row.serviceCode,
      amountNet: row.amountNet,
      status: row.status,
    })),
    paidExtrasScale: [...paidExtrasByCode.values()],
    paidDiagnosticsScale: [...paidDiagnosticsByCode.values()],
    intakeChecklist,
    examNotesPreview: examNotes.map((e) => {
      let titleL10n: L10n | undefined;
      let title = e.templateId ?? "Exam";
      try {
        const payload = JSON.parse(e.payloadJson) as { title?: L10n | string; templateCode?: string };
        if (payload.title && typeof payload.title === "object") {
          titleL10n = payload.title;
          title = payload.title.en || e.templateId || "Exam";
        } else if (typeof payload.title === "string" && payload.title.trim()) {
          title = payload.title;
        }
      } catch {
        /* keep defaults */
      }
      return {
        id: e.id,
        visitId: e.visit.id,
        at: e.createdAt.toISOString(),
        atLabel: bakuDateTimeLabel(e.createdAt),
        title,
        titleL10n,
        templateId: e.templateId,
        doctorName: e.visit.practitioner.fullName,
        href: `/visits/${e.visit.id}`,
        printHref: `/print/visit-exam/${e.id}`,
      };
    }),
  };
}

export type HistoryLabFilter = "results" | "pending" | "all";

export async function getPatientHistoryPage(
  patientRefId: string,
  opts: {
    types?: TimelineEventType[];
    labFilter?: HistoryLabFilter;
    /** When set, only lab_order rows matching catalog kind (analizlər vs müayinələr). */
    labCatalogKind?: "panel" | "imaging";
    from?: Date;
    to?: Date;
    offset?: number;
    limit?: number;
    episodeId?: string;
  },
) {
  const [settings, catalog] = await Promise.all([getClinicSettings(), getDiagnosticCatalog()]);
  const limit = opts.limit ?? settings.patientCardHistoryPageSize;
  const offset = opts.offset ?? 0;
  const types = opts.types?.length ? new Set(opts.types) : null;
  const labFilter = opts.labFilter ?? "all";
  const labCatalogKind = opts.labCatalogKind;
  const episodeFilter = opts.episodeId ? { clinicalEpisodeId: opts.episodeId } : {};

  const wantVisit = !types || types.has("visit");
  const wantAppt = !types || types.has("appointment");
  const wantLab =
    Boolean(labCatalogKind) || !types || types.has("lab_order");
  const loadEncounters = !types || wantVisit || wantAppt;

  const [visits, labOrders, appointments] = await Promise.all([
    loadEncounters
      ? prisma.visit.findMany({
          where: { patientRefId, ...episodeFilter },
          include: {
            practitioner: { select: { fullName: true, code: true } },
            serviceLines: true,
            appointment: { select: { scheduledAt: true, roomCode: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
    wantLab
      ? prisma.labOrder.findMany({
          where: { patientRefId, ...episodeFilter },
          orderBy: { createdAt: "desc" },
          take: 400,
        })
      : Promise.resolve([]),
    loadEncounters
      ? prisma.appointment.findMany({
          where: { patientRefId },
          include: {
            practitioner: { select: { fullName: true, code: true } },
            visit: { select: { id: true } },
          },
          orderBy: { scheduledAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  let events: PatientTimelineEvent[] = [];

  if (wantVisit || wantAppt) {
    const merged = mergeAppointmentVisitEvents({ appointments, visits });
    events.push(
      ...merged.filter((ev) => {
        if (ev.type === "visit") return wantVisit;
        if (ev.type === "appointment") return wantAppt;
        return false;
      }),
    );
  }

  for (const o of labOrders) {
    if (labFilter === "results" && !RESULT_STATUSES.has(o.status)) continue;
    if (labFilter === "pending" && !PENDING_LAB_STATUSES.has(o.status)) continue;
    if (
      labCatalogKind &&
      !matchesLabCatalogKind(o.testCode, catalog.items, labCatalogKind)
    ) {
      continue;
    }
    events.push(mapLabEvent(o, catalog.items));
  }

  if (opts.from) {
    const fromMs = opts.from.getTime();
    events = events.filter((e) => new Date(e.at).getTime() >= fromMs);
  }
  if (opts.to) {
    const toMs = opts.to.getTime();
    events = events.filter((e) => new Date(e.at).getTime() <= toMs);
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const slice = events.slice(offset, offset + limit);
  const hasMore = offset + limit < events.length;

  return {
    patientRefId,
    events: slice,
    days: groupDays(slice),
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    total: events.length,
  };
}

export async function getPatientPlanPage(
  patientRefId: string,
  opts: {
    offset?: number;
    limit?: number;
    from?: Date;
    to?: Date;
    episodeId?: string;
    locale?: string;
  },
) {
  const settings = await getClinicSettings();
  const paged = opts.limit != null;
  const limit = opts.limit ?? settings.patientCardPlanPageSize;
  const offset = opts.offset ?? 0;
  const episodeFilter = opts.episodeId ? { clinicalEpisodeId: opts.episodeId } : {};

  const showUnpaid = showsUnpaidExtraOnPlan(settings.extraProcedureRoute);
  const unseatedPackage = {
    status: "PROPOSED" as const,
    inPackage: true,
    resourceId: null,
  };
  const where = {
    patientRefId,
    ...episodeFilter,
    NOT: unseatedPackage,
    OR: [
      { status: "PROPOSED" as const },
      {
        status: { in: ["SCHEDULED", "CHECKED_IN"] as ("SCHEDULED" | "CHECKED_IN")[] },
        ...(opts.from || opts.to
          ? {
              scheduledAt: {
                ...(opts.from ? { gte: opts.from } : {}),
                ...(opts.to ? { lte: opts.to } : {}),
              },
            }
          : {}),
      },
      ...(showUnpaid
        ? [{ status: "PENDING_PAY" as const, inPackage: false }]
        : []),
    ],
  };

  const [total, rows, unplacedRows] = await Promise.all([
    prisma.procedureOrder.count({ where }),
    prisma.procedureOrder.findMany({
      where,
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      ...(paged ? { skip: offset, take: limit } : {}),
    }),
    prisma.procedureOrder.findMany({
      where: { patientRefId, ...episodeFilter, ...unseatedPackage },
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { procedureCode: "asc" },
    }),
  ]);

  const catalogNames = await loadCatalogDisplayNameMap(
    [...rows, ...unplacedRows].map((row) => row.procedureCode),
    opts.locale ?? "az",
  );
  const events: PatientTimelineEvent[] = rows.map((p) =>
    mapProcedureEvent({
      ...p,
      procedureName: catalogNames.get(p.procedureCode) || p.procedureName,
    }),
  );
  const unplaced: PatientTimelineEvent[] = unplacedRows.map((p) => ({
    ...mapProcedureEvent({
      ...p,
      procedureName: catalogNames.get(p.procedureCode) || p.procedureName,
    }),
    showClock: false,
  }));

  const hasMore = paged && offset + limit < total;
  return {
    patientRefId,
    events: events.map(withTimeSubtitle),
    unplaced,
    days: groupDays(events, "plan"),
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    total,
  };
}
