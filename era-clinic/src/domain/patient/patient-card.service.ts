import { prisma } from "@/lib/prisma";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import type { DiagnosticCatalogItem, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { hasCriticalFlag, type ResultLineInput } from "@/lib/lab-result-flags";
import { getClinicSettings } from "@/domain/settings/settings.service";
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

const RESULT_STATUSES = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);
const PENDING_LAB_STATUSES = new Set(["ORDERED", "COLLECTED", "IN_PROGRESS"]);

function bakuTimeLabel(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

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
): { title: string; titleL10n?: L10n } {
  const primary = testCode.split(",")[0]?.trim() ?? testCode;
  const item = catalogItems.find((i) => i.code === primary || i.serviceCode === primary);
  if (!item) return { title: testCode };
  return { title: `${item.title.en} (${testCode})`, titleL10n: item.title };
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
  return {
    ...ev,
    subtitle: ev.subtitle
      ? `${bakuTimeLabel(ev.at)} · ${ev.subtitle}`
      : bakuTimeLabel(ev.at),
  };
}

function mapProcedureEvent(p: {
  id: string;
  scheduledAt: Date;
  procedureName: string;
  procedureCode: string;
  status: string;
  bodyPart: string | null;
  note: string | null;
  siteApplyMode: "TOGETHER" | "TURN" | null;
  physioFields?: unknown;
  amountNet: { toString(): string };
  procedureType?: { needsSite: boolean; physioOrderFields?: string[] } | null;
  sites: Array<{ siteId: string; laterality?: "LEFT" | "RIGHT" | "BOTH" | null }>;
}): PatientTimelineEvent {
  const siteCodes = p.sites.length ? `${p.sites.length} S` : null;
  return {
    id: `procedure:${p.id}`,
    type: "procedure",
    at: p.scheduledAt.toISOString(),
    title: `Procedure · ${p.procedureName}`,
    subtitle: [p.procedureCode, siteCodes, p.bodyPart].filter(Boolean).join(" · "),
    status: p.status,
    codes: [p.procedureCode],
    amountNet: p.amountNet.toString(),
    physio: toPhysioOrderPayload(p),
  };
}

function groupDays(events: PatientTimelineEvent[]): PatientTimelineDay[] {
  const dayMap = new Map<string, PatientTimelineEvent[]>();
  for (const ev of events) {
    const key = bakuDateKey(ev.at);
    const list = dayMap.get(key) ?? [];
    list.push(withTimeSubtitle(ev));
    dayMap.set(key, list);
  }
  const todayKey = bakuDateKey(new Date());
  return [...dayMap.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      labelHint: date === todayKey ? "today" : "",
      events: (dayMap.get(date) ?? []).sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    }));
}

export async function getPatientCardSummary(patientRefId: string) {
  const [settings, catalog] = await Promise.all([getClinicSettings(), getDiagnosticCatalog()]);
  const now = new Date();

  const [
    nextAppointment,
    activeEpisode,
    nextProcedure,
    pendingLabs,
    resultLabs,
    upcomingProcedures,
    proposedProcedures,
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
    prisma.clinicalEpisode.findFirst({
      where: { patientRefId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    }),
    prisma.procedureOrder.findFirst({
      where: {
        patientRefId,
        status: { in: ["SCHEDULED", "CHECKED_IN"] as ("SCHEDULED" | "CHECKED_IN")[] },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.labOrder.findMany({
      where: { patientRefId, status: { in: ["ORDERED", "COLLECTED", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.labOrder.findMany({
      where: {
        patientRefId,
        status: { in: ["RESULT_READY", "PUBLISHED", "COMPLETED"] },
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
        status: { in: ["SCHEDULED", "CHECKED_IN"] as ("SCHEDULED" | "CHECKED_IN")[] },
      },
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      take: settings.patientCardPlanPreview,
    }),
    prisma.procedureOrder.findMany({
      where: {
        patientRefId,
        status: "PROPOSED",
      },
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      take: settings.patientCardPlanPreview,
    }),
  ]);

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
            name: nextProcedure.procedureName,
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
    planPreview: upcomingProcedures.map((p) => withTimeSubtitle(mapProcedureEvent(p))),
    proposedPreview: proposedProcedures.map((p) => withTimeSubtitle(mapProcedureEvent(p))),
  };
}

export type HistoryLabFilter = "results" | "pending" | "all";

export async function getPatientHistoryPage(
  patientRefId: string,
  opts: {
    types?: TimelineEventType[];
    labFilter?: HistoryLabFilter;
    from?: Date;
    to?: Date;
    offset?: number;
    limit?: number;
  },
) {
  const [settings, catalog] = await Promise.all([getClinicSettings(), getDiagnosticCatalog()]);
  const limit = opts.limit ?? settings.patientCardHistoryPageSize;
  const offset = opts.offset ?? 0;
  const types = opts.types?.length ? new Set(opts.types) : null;
  const labFilter = opts.labFilter ?? "all";

  const wantVisit = !types || types.has("visit");
  const wantAppt = !types || types.has("appointment");
  const loadEncounters = !types || wantVisit || wantAppt;

  const [visits, labOrders, appointments] = await Promise.all([
    loadEncounters
      ? prisma.visit.findMany({
          where: { patientRefId },
          include: {
            practitioner: { select: { fullName: true, code: true } },
            serviceLines: true,
            appointment: { select: { scheduledAt: true, roomCode: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
    !types || types.has("lab_order")
      ? prisma.labOrder.findMany({
          where: { patientRefId },
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
  opts: { offset?: number; limit?: number; from?: Date; to?: Date },
) {
  const settings = await getClinicSettings();
  const limit = opts.limit ?? settings.patientCardPlanPageSize;
  const offset = opts.offset ?? 0;

  const where = {
    patientRefId,
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
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.procedureOrder.count({ where }),
    prisma.procedureOrder.findMany({
      where,
      include: PROCEDURE_PHYSIO_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      skip: offset,
      take: limit,
    }),
  ]);

  const events: PatientTimelineEvent[] = rows.map((p) => mapProcedureEvent(p));

  const hasMore = offset + limit < total;
  return {
    patientRefId,
    events: events.map(withTimeSubtitle),
    days: groupDays(events),
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    total,
  };
}
