import { prisma } from "@/lib/prisma";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import type { DiagnosticCatalogItem, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { hasCriticalFlag, type ResultLineInput } from "@/lib/lab-result-flags";

export type TimelineEventType =
  | "appointment"
  | "visit"
  | "lab_order"
  | "procedure"
  | "episode";

export type PatientTimelineEvent = {
  id: string;
  type: TimelineEventType;
  at: string;
  title: string;
  /** Localized catalog title when available (labs / studies) */
  titleL10n?: L10n;
  subtitle?: string;
  status: string;
  href?: string;
  codes?: string[];
  amountNet?: string;
  hasCritical?: boolean;
  resultSummary?: Array<{ code: string; value: string; flag?: string }>;
  physio?: {
    needsSite: boolean;
    physioOrderFields: string[];
    siteIds: string[];
    siteApplyMode: "TOGETHER" | "TURN" | null;
    siteLaterality: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
    physioFields: Record<string, unknown>;
    note: string | null;
    bodyPart: string | null;
  };
};

export type PatientTimelineDay = {
  /** Calendar day in Asia/Baku (YYYY-MM-DD) */
  date: string;
  labelHint: string;
  events: PatientTimelineEvent[];
};

const BAKU_TZ = "Asia/Baku";

export function bakuDateKey(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function bakuTimeLabel(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BAKU_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export type TimelineAppointmentInput = {
  id: string;
  scheduledAt: Date;
  roomCode: string | null;
  status: string;
  practitioner: { fullName: string; code: string };
  visit?: { id: string } | null;
};

export type TimelineVisitInput = {
  id: string;
  appointmentId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  status: string;
  amountNet: { toString(): string };
  practitioner: { fullName: string; code: string };
  serviceLines: Array<{ serviceCode: string }>;
  appointment?: { scheduledAt: Date; roomCode: string | null } | null;
};

/**
 * One row per encounter: visit wins (slot date + /visits/[id]).
 * Appointment-only rows stay for slots with no visit (no-show / not yet opened).
 */
export function mergeAppointmentVisitEvents(input: {
  appointments: TimelineAppointmentInput[];
  visits: TimelineVisitInput[];
}): PatientTimelineEvent[] {
  const events: PatientTimelineEvent[] = [];
  const visitAppointmentIds = new Set<string>();

  for (const v of input.visits) {
    if (v.appointmentId) visitAppointmentIds.add(v.appointmentId);
    const slot = v.appointment?.scheduledAt ?? v.completedAt ?? v.createdAt;
    const services = v.serviceLines.map((s) => s.serviceCode).filter(Boolean);
    const room = v.appointment?.roomCode ?? null;
    const name = v.practitioner.fullName;
    events.push({
      id: `visit:${v.id}`,
      type: "visit",
      at: slot.toISOString(),
      title: `Visit · ${name}`,
      titleL10n: {
        en: `Visit · ${name}`,
        ru: `Приём · ${name}`,
        az: `Qəbul · ${name}`,
      },
      subtitle:
        services.length > 0
          ? services.slice(0, 6).join(", ") + (services.length > 6 ? "…" : "")
          : room
            ? `Room ${room}`
            : v.practitioner.code,
      status: v.status,
      href: `/visits/${v.id}`,
      codes: services,
      amountNet: v.amountNet.toString(),
    });
  }

  for (const a of input.appointments) {
    if (a.visit?.id || visitAppointmentIds.has(a.id)) continue;
    events.push({
      id: `appointment:${a.id}`,
      type: "appointment",
      at: a.scheduledAt.toISOString(),
      title: `Appointment · ${a.practitioner.fullName}`,
      titleL10n: {
        en: `Appointment · ${a.practitioner.fullName}`,
        ru: `Запись · ${a.practitioner.fullName}`,
        az: `Yazı · ${a.practitioner.fullName}`,
      },
      subtitle: a.roomCode ? `Room ${a.roomCode}` : a.practitioner.code,
      status: a.status,
      href: "/appointments",
    });
  }

  return events;
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
  return {
    title: `${item.title.en} (${testCode})`,
    titleL10n: item.title,
  };
}

export async function getPatientTimeline(
  patientRefId: string,
  opts?: { types?: TimelineEventType[]; limitDays?: number },
): Promise<{ patientRefId: string; days: PatientTimelineDay[] }> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientRefId } });
  if (!patient) {
    throw new Error("Patient not found");
  }

  const catalog = await getDiagnosticCatalog();

  const [appointments, visits, labOrders, procedures, episodes] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientRefId },
      include: {
        practitioner: { select: { fullName: true, code: true } },
        visit: { select: { id: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    }),
    prisma.visit.findMany({
      where: { patientRefId },
      include: {
        practitioner: { select: { fullName: true, code: true } },
        serviceLines: true,
        appointment: { select: { scheduledAt: true, roomCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.labOrder.findMany({
      where: { patientRefId },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.procedureOrder.findMany({
      where: { patientRefId },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    }),
    prisma.clinicalEpisode.findMany({
      where: { patientRefId },
      include: {
        diagnoses: {
          take: 3,
          orderBy: { recordedAt: "desc" },
          include: { icdCode: true },
        },
        complaints: { take: 2, orderBy: { recordedAt: "desc" } },
      },
      orderBy: { openedAt: "desc" },
      take: 50,
    }),
  ]);

  const events: PatientTimelineEvent[] = mergeAppointmentVisitEvents({
    appointments,
    visits,
  });

  for (const o of labOrders) {
    const at = (
      o.publishedAt ??
      o.completedAt ??
      o.collectedAt ??
      o.createdAt
    ).toISOString();
    const lines = parseResultLines(o.resultJson);
    const codes = o.testCode.split(",").map((c) => c.trim()).filter(Boolean);
    const labInfo = labCatalog(o.testCode, catalog.items);
    events.push({
      id: `lab_order:${o.id}`,
      type: "lab_order",
      at,
      title: labInfo.title,
      titleL10n: labInfo.titleL10n,
      subtitle:
        o.status === "PUBLISHED" || o.status === "COMPLETED" || o.status === "RESULT_READY"
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
    });
  }

  for (const p of procedures) {
    events.push({
      id: `procedure:${p.id}`,
      type: "procedure",
      at: p.scheduledAt.toISOString(),
      title: `Procedure · ${p.procedureName}`,
      subtitle: p.procedureCode,
      status: p.status,
      codes: [p.procedureCode],
      amountNet: p.amountNet.toString(),
    });
  }

  for (const e of episodes) {
    const dx = e.diagnoses
      .map((d) => {
        const code = d.icdCode?.code;
        const title = d.icdCode
          ? d.icdCode.titleEn
          : null;
        return code ? (title ? `${code} — ${title}` : code) : d.note;
      })
      .filter(Boolean);
    events.push({
      id: `episode:${e.id}:open`,
      type: "episode",
      at: e.openedAt.toISOString(),
      title: e.programCode
        ? `Sanatorium episode · ${e.programCode}`
        : "Sanatorium episode",
      subtitle: dx.slice(0, 2).join("; ") || e.roomNumber || e.status,
      status: e.status,
      href: "/sanatorium",
      codes: e.programCode ? [e.programCode] : undefined,
    });
    if (e.closedAt) {
      events.push({
        id: `episode:${e.id}:close`,
        type: "episode",
        at: e.closedAt.toISOString(),
        title: "Episode closed",
        subtitle: e.programCode ?? undefined,
        status: "CLOSED",
        href: "/sanatorium",
      });
    }
  }

  const typeFilter = opts?.types?.length ? new Set(opts.types) : null;
  const filtered = typeFilter
    ? events.filter((ev) => typeFilter.has(ev.type))
    : events;

  filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const dayMap = new Map<string, PatientTimelineEvent[]>();
  for (const ev of filtered) {
    const key = bakuDateKey(ev.at);
    const list = dayMap.get(key) ?? [];
    list.push(ev);
    dayMap.set(key, list);
  }

  const sortedKeys = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));
  const limit = opts?.limitDays && opts.limitDays > 0 ? opts.limitDays : undefined;
  const keys = limit ? sortedKeys.slice(0, limit) : sortedKeys;

  const todayKey = bakuDateKey(new Date());
  const days: PatientTimelineDay[] = keys.map((date) => {
    const dayEvents = (dayMap.get(date) ?? []).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
    return {
      date,
      labelHint: date === todayKey ? "today" : "",
      events: dayEvents.map((ev) => ({
        ...ev,
        subtitle: ev.subtitle
          ? `${bakuTimeLabel(ev.at)} · ${ev.subtitle}`
          : bakuTimeLabel(ev.at),
      })),
    };
  });

  return { patientRefId, days };
}
