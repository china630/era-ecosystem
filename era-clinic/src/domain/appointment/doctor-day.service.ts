import type { SatelliteSessionPayload } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { bakuDayBounds, bakuDateKey } from "@/lib/baku-day";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { hasCriticalFlag, type ResultLineInput } from "@/lib/lab-result-flags";
import { labOrderVisibleToLabWhere } from "@/domain/lab/lab-order-pay-gate";

const READY_LAB_STATUSES = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);

function parseResultLines(resultJson: string | null): ResultLineInput[] {
  if (!resultJson) return [];
  try {
    const parsed = JSON.parse(resultJson) as ResultLineInput[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type DoctorDayEntry = {
  appointmentId: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: string;
  mode: string;
  videoRoomUrl: string | null;
  practitioner: { id: string; code: string; fullName: string };
  patient: {
    id: string;
    refCode: string;
    fullName: string;
    sex: string | null;
    birthDate: string | null;
    bloodGroup: string;
  };
  visitId: string | null;
  visitStatus: string | null;
  queueTicket: {
    id: string;
    queueNumber: number;
    status: string;
    desk: string | null;
  } | null;
  flags: {
    hasUnsignedProtocol: boolean;
    hasReadyLabs: boolean;
    hasCriticalLab: boolean;
  };
};

export type DoctorDayBoard = {
  date: string;
  scopeMode: "ALL" | "ASSIGNED";
  practitionerId: string | null;
  entries: DoctorDayEntry[];
};

export async function getDoctorDayBoard(
  session: SatelliteSessionPayload,
  dateYmd: string,
  practitionerIdFilter?: string | null,
): Promise<DoctorDayBoard> {
  const scope = await resolveClinicDataScope(session, CLINIC_PERMISSION.API_APPOINTMENTS_READ);
  const { start: dayStart, end: dayEnd } = bakuDayBounds(dateYmd);

  let practitionerIds: string[] | undefined;
  if (scope.mode === "ASSIGNED") {
    if (!scope.practitionerId) {
      return {
        date: dateYmd,
        scopeMode: scope.mode,
        practitionerId: null,
        entries: [],
      };
    }
    practitionerIds = [scope.practitionerId];
  } else if (practitionerIdFilter) {
    practitionerIds = [practitionerIdFilter];
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(practitionerIds ? { practitionerId: { in: practitionerIds } } : {}),
    },
    include: {
      patientRef: {
        select: {
          id: true,
          refCode: true,
          fullName: true,
          sex: true,
          birthDate: true,
          bloodGroup: true,
        },
      },
      practitioner: { select: { id: true, code: true, fullName: true } },
      visit: {
        select: {
          id: true,
          status: true,
          queueTickets: {
            where: { status: { in: ["WAITING", "CALLED"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, queueNumber: true, status: true, desk: true },
          },
          clinicalNotes: {
            select: { id: true, status: true },
          },
          cpoeEntries: { select: { id: true }, take: 1 },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const patientIds = [...new Set(appointments.map((a) => a.patientRefId))];
  const labByPatient = new Map<
    string,
    { hasReady: boolean; hasCritical: boolean }
  >();

  if (patientIds.length > 0) {
    const labs = await prisma.labOrder.findMany({
      where: {
        patientRefId: { in: patientIds },
        status: { in: [...READY_LAB_STATUSES] },
        AND: [labOrderVisibleToLabWhere()],
        OR: [
          { items: { some: { results: { some: {} } } } },
          { AND: [{ resultJson: { not: null } }, { NOT: { resultJson: { in: ["", "[]"] } } }] },
        ],
      },
      select: { patientRefId: true, resultJson: true, status: true },
      orderBy: { publishedAt: "desc" },
      take: 200,
    });
    for (const lab of labs) {
      const lines = parseResultLines(lab.resultJson);
      const critical = lines.some((line) => hasCriticalFlag(line));
      const cur = labByPatient.get(lab.patientRefId) ?? {
        hasReady: false,
        hasCritical: false,
      };
      cur.hasReady = true;
      if (critical) cur.hasCritical = true;
      labByPatient.set(lab.patientRefId, cur);
    }
  }

  const entries: DoctorDayEntry[] = appointments.map((a) => {
    const duration = a.durationMinutes > 0 ? a.durationMinutes : 30;
    const endsAt = new Date(a.scheduledAt.getTime() + duration * 60_000);
    const visit = a.visit;
    const ticket = visit?.queueTickets?.[0] ?? null;
    const hasSignedNote = (visit?.clinicalNotes ?? []).some((n) => n.status === "SIGNED");
    const hasCpoe = (visit?.cpoeEntries?.length ?? 0) > 0;
    const unsigned = Boolean(
      visit &&
        visit.status === "IN_PROGRESS" &&
        !hasSignedNote &&
        !hasCpoe,
    );
    const labFlags = labByPatient.get(a.patientRefId) ?? {
      hasReady: false,
      hasCritical: false,
    };

    return {
      appointmentId: a.id,
      scheduledAt: a.scheduledAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes: duration,
      status: a.status,
      mode: a.mode,
      videoRoomUrl: a.videoRoomUrl,
      practitioner: a.practitioner,
      patient: {
        id: a.patientRef.id,
        refCode: a.patientRef.refCode,
        fullName: a.patientRef.fullName,
        sex: a.patientRef.sex,
        birthDate: a.patientRef.birthDate
          ? bakuDateKey(a.patientRef.birthDate)
          : null,
        bloodGroup: a.patientRef.bloodGroup,
      },
      visitId: visit?.id ?? null,
      visitStatus: visit?.status ?? null,
      queueTicket: ticket
        ? {
            id: ticket.id,
            queueNumber: ticket.queueNumber,
            status: ticket.status,
            desk: ticket.desk,
          }
        : null,
      flags: {
        hasUnsignedProtocol: unsigned,
        hasReadyLabs: labFlags.hasReady,
        hasCriticalLab: labFlags.hasCritical,
      },
    };
  });

  return {
    date: dateYmd,
    scopeMode: scope.mode,
    practitionerId: scope.practitionerId,
    entries,
  };
}