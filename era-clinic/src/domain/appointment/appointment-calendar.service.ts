import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { listClinicDays } from "@/domain/planning/clinic-day";
import { addBakuDays, bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import {
  intervalsCover,
  resolveManyDayIntervals,
} from "@/domain/appointment/practitioner-schedule.service";

const BAKU_OFFSET = "+04:00";

function bakuYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function bakuSlotStart(ymd: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00${BAKU_OFFSET}`);
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export type PractitionerCalendarSlot = {
  time: string;
  endsAt?: string;
  occupied: boolean;
  blocked?: boolean;
  lunch?: boolean;
  offShift?: boolean;
  /** Mapped into ResourceDayMatrix as procedureOrderId for DnD. */
  procedureOrderId?: string;
  patientName?: string;
  procedureName?: string;
  status?: string;
  patientRefId?: string;
  patientRefCode?: string;
  procedureCode?: string;
  visitId?: string | null;
  practitionerCode?: string;
  durationMinutes?: number;
};

export type PractitionerCalendarRow = {
  resourceId: string;
  code: string;
  name: string;
  slotMinutes: number;
  slots: PractitionerCalendarSlot[];
};

/**
 * Day matrix for outpatient appointments: rows = active practitioners.
 * Wall-clock Asia/Baku; lunch from tenant hours.
 */
export async function getPractitionerDayMatrix(dayInput: Date): Promise<{
  date: string;
  slotMinutes: number;
  defaultAppointmentSlotMinutes: number;
  visitServices: Array<{ code: string; name: string; durationMin: number }>;
  resources: PractitionerCalendarRow[];
}> {
  const dateYmd = bakuYmd(dayInput);
  const settings = await getSchedulingSettings();
  const gridMinutes = Math.max(5, settings.schedulingSlotMinutes || 5);
  const defaultAppointmentSlotMinutes = settings.defaultAppointmentSlotMinutes ?? 30;
  const visitServices = await prisma.procedureType.findMany({
    where: { code: { startsWith: "VISIT-" } },
    select: { code: true, name: true, durationMin: true },
    orderBy: { name: "asc" },
  });
  const visits = visitServices.map((row) => ({
    code: row.code,
    name: row.name,
    durationMin: row.durationMin > 0 ? row.durationMin : defaultAppointmentSlotMinutes,
  }));
  const { lunchStartHour, lunchEndHour } = settings;

  const [clinicDay] = await listClinicDays(dateYmd, addBakuDays(dateYmd, 1));
  if (!clinicDay?.working) {
    return {
      date: dateYmd,
      slotMinutes: gridMinutes,
      defaultAppointmentSlotMinutes,
      visitServices: visits,
      resources: [],
    };
  }

  const dayStartHour = clinicDay.startHour;
  const dayEndHour = clinicDay.endHour;

  const dayStart = bakuSlotStart(dateYmd, 0, 0);
  const dayEnd = addMinutes(bakuSlotStart(dateYmd, 23, 59), 1);

  const practitioners = await prisma.practitioner.findMany({
    where: { active: true, staffKind: "DOCTOR" },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      code: true,
      fullName: true,
    },
  });

  const gridSlots: Array<{ start: Date; end: Date; lunch: boolean; startMin: number }> = [];
  for (let h = dayStartHour; h < dayEndHour; h++) {
    for (let m = 0; m < 60; m += gridMinutes) {
      const start = bakuSlotStart(dateYmd, h, m);
      const end = addMinutes(start, gridMinutes);
      const lunch = h >= lunchStartHour && h < lunchEndHour;
      gridSlots.push({ start, end, lunch, startMin: h * 60 + m });
    }
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      practitionerId: { in: practitioners.map((p) => p.id) },
    },
    include: {
      patientRef: { select: { id: true, refCode: true, fullName: true } },
      visit: { select: { id: true, status: true } },
      practitioner: { select: { code: true } },
    },
  });

  const byPractitioner = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const list = byPractitioner.get(a.practitionerId) ?? [];
    list.push(a);
    byPractitioner.set(a.practitionerId, list);
  }

  // CLI-36 — per-practitioner shift intervals for this day (null = unrestricted).
  const shiftIntervals = await resolveManyDayIntervals(
    practitioners.map((p) => p.id),
    dateYmd,
  );

  const resources: PractitionerCalendarRow[] = practitioners.map((p) => {
    const appts = byPractitioner.get(p.id) ?? [];
    const intervals = shiftIntervals.get(p.id) ?? null;
    const slots: PractitionerCalendarSlot[] = gridSlots.map(({ start, end, lunch, startMin }) => {
      if (lunch) {
        return {
          time: start.toISOString(),
          endsAt: end.toISOString(),
          occupied: false,
          blocked: true,
          lunch: true,
        };
      }
      // Off-shift slots are blocked (doctor not on rotation this window).
      if (!intervalsCover(intervals, startMin, startMin + gridMinutes)) {
        return {
          time: start.toISOString(),
          endsAt: end.toISOString(),
          occupied: false,
          blocked: true,
          offShift: true,
        };
      }
      const hit = appts.find((a) => {
        const aStart = a.scheduledAt;
        const aEnd = new Date(aStart.getTime() + (a.durationMinutes || gridMinutes) * 60_000);
        return aStart < end && aEnd > start;
      });
      if (!hit) {
        return {
          time: start.toISOString(),
          endsAt: end.toISOString(),
          occupied: false,
        };
      }
      const aEnd = new Date(
        hit.scheduledAt.getTime() + (hit.durationMinutes || gridMinutes) * 60_000,
      );
      return {
        time: start.toISOString(),
        endsAt: aEnd.toISOString(),
        occupied: true,
        procedureOrderId: hit.id,
        patientName: hit.patientRef.fullName,
        patientRefId: hit.patientRef.id,
        patientRefCode: hit.patientRef.refCode,
        procedureName: hit.status,
        procedureCode: "APPT",
        status: hit.status,
        visitId: hit.visit?.id ?? null,
        durationMinutes: hit.durationMinutes,
        practitionerCode: p.code,
      };
    });

    return {
      resourceId: p.id,
      code: p.code,
      name: p.fullName,
      slotMinutes: gridMinutes,
      slots,
    };
  });

  return {
    date: dateYmd,
    slotMinutes: gridMinutes,
    defaultAppointmentSlotMinutes,
    visitServices: visits,
    resources,
  };
}

export async function listAppointmentsRecent(take = 100) {
  return prisma.appointment.findMany({
    include: { patientRef: true, practitioner: true, visit: true },
    orderBy: { scheduledAt: "desc" },
    take,
  });
}

export async function resolvePatientForAppointment(
  organizationId: string,
  patientRefId?: string,
  patientRefCode?: string,
) {
  if (patientRefId) {
    return prisma.patientRef.findUnique({ where: { id: patientRefId } });
  }
  return prisma.patientRef.findFirst({
    where: { organizationId, refCode: patientRefCode! },
  });
}

export async function findPractitionerByCode(code: string) {
  return prisma.practitioner.findFirst({
    where: { code },
  });
}

export async function findPractitionerById(id: string) {
  return prisma.practitioner.findUnique({
    where: { id },
  });
}

export async function findServiceCatalogLine(organizationId: string, serviceCode: string) {
  return prisma.serviceCatalogCache.findFirst({
    where: { organizationId, code: serviceCode },
    select: { description: true, amount: true, listAmount: true },
  });
}

export async function createAppointmentWithVisit(input: {
  organizationId: string;
  patientRefId: string;
  practitionerId: string;
  scheduledAt: Date;
  durationMinutes: number;
  roomCode: string | null;
  resourceId: string | null;
  amountNet: number;
  serviceLines: Array<{ serviceCode: string; description: string; amount: number }>;
}) {
  return prisma.appointment.create({
    data: {
      organizationId: input.organizationId,
      patientRefId: input.patientRefId,
      practitionerId: input.practitionerId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      roomCode: input.roomCode,
      resourceId: input.resourceId,
      visit: {
        create: {
          organizationId: input.organizationId,
          patientRefId: input.patientRefId,
          practitionerId: input.practitionerId,
          amountNet: input.amountNet,
          serviceLines: {
            create: input.serviceLines.map((line) => ({
              serviceCode: line.serviceCode,
              description: line.description,
              amount: line.amount,
            })),
          },
        },
      },
    },
    include: {
      patientRef: true,
      practitioner: true,
      visit: { include: { serviceLines: true } },
    },
  });
}

export async function createScheduledBookingAppointment(input: {
  organizationId: string;
  patientRefId: string;
  practitionerId: string;
  scheduledAt: Date;
  durationMinutes: number;
}) {
  return prisma.appointment.create({
    data: {
      organizationId: input.organizationId,
      patientRefId: input.patientRefId,
      practitionerId: input.practitionerId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      status: "SCHEDULED",
    },
    include: { patientRef: true, practitioner: true },
  });
}

export async function findAppointmentForReschedule(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { practitioner: true },
  });
}

export async function updateAppointmentReschedule(input: {
  id: string;
  scheduledAt: Date;
  practitionerId: string;
  roomCode: string | null;
  resourceId: string | null;
}) {
  return prisma.appointment.update({
    where: { id: input.id },
    data: {
      scheduledAt: input.scheduledAt,
      practitionerId: input.practitionerId,
      roomCode: input.roomCode,
      resourceId: input.resourceId,
    },
    include: { patientRef: true, practitioner: true, visit: true },
  });
}

export async function findAppointmentWithVisit(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { visit: true },
  });
}

export async function cancelAppointmentWithVisit(id: string) {
  const appt = await findAppointmentWithVisit(id);
  if (!appt) return null;
  if (appt.visit && appt.visit.status !== "CANCELLED" && appt.visit.status !== "COMPLETED") {
    await prisma.visit.update({
      where: { id: appt.visit.id },
      data: { status: "CANCELLED" },
    });
  }
  return prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { patientRef: true, practitioner: true, visit: true },
  });
}

async function nextQueueNumberForToday(): Promise<number> {
  const { start: startOfDay, end: endOfDay } = bakuDayBounds(todayBakuYmd());
  const last = await prisma.queueTicket.findFirst({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true },
  });
  return (last?.queueNumber ?? 0) + 1;
}

export async function checkInScheduledAppointment(id: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { visit: true },
  });
  if (!appointment) return { kind: "not_found" as const };
  if (appointment.status !== "SCHEDULED") {
    return { kind: "bad_status" as const, status: appointment.status };
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "CHECKED_IN" },
    include: { patientRef: true, practitioner: true, visit: true },
  });

  if (updated.visit) {
    await prisma.visit.update({
      where: { id: updated.visit.id },
      data: { status: "IN_PROGRESS" },
    });

    await prisma.queueTicket.create({
      data: {
        visitId: updated.visit.id,
        queueNumber: await nextQueueNumberForToday(),
      },
    });
  }

  return { kind: "ok" as const, appointment: updated };
}

export async function findVisitById(visitId: string) {
  return prisma.visit.findUnique({ where: { id: visitId } });
}

export async function findActiveQueueTicketForVisit(visitId: string) {
  return prisma.queueTicket.findFirst({
    where: { visitId, status: { in: ["WAITING", "CALLED"] } },
  });
}

export async function createQueueTicket(input: { visitId: string; desk?: string }) {
  return prisma.queueTicket.create({
    data: {
      visitId: input.visitId,
      queueNumber: await nextQueueNumberForToday(),
      desk: input.desk,
    },
    include: {
      visit: { include: { patientRef: true, practitioner: true } },
    },
  });
}

export async function findQueueTicketById(id: string) {
  return prisma.queueTicket.findUnique({ where: { id } });
}

export async function callQueueTicket(id: string, desk?: string) {
  const ticket = await prisma.queueTicket.findUnique({ where: { id } });
  if (!ticket) return { kind: "not_found" as const };
  if (ticket.status !== "WAITING") {
    return { kind: "bad_status" as const, status: ticket.status };
  }
  const updated = await prisma.queueTicket.update({
    where: { id },
    data: {
      status: "CALLED",
      calledAt: new Date(),
      desk: desk ?? ticket.desk,
    },
    include: {
      visit: { include: { patientRef: true, practitioner: true } },
    },
  });
  return { kind: "ok" as const, ticket: updated };
}

export async function listQueueBoardTickets(take = 50) {
  return prisma.queueTicket.findMany({
    where: { status: { in: ["WAITING", "CALLED"] } },
    include: {
      visit: { include: { patientRef: true, practitioner: true } },
    },
    orderBy: [{ status: "asc" }, { queueNumber: "asc" }],
    take,
  });
}

export async function processAppointmentRemindersForOrganization(organizationId: string) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600_000);
  const windowStart = new Date(in24h.getTime() - 30 * 60_000);
  const windowEnd = new Date(in24h.getTime() + 30 * 60_000);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
    },
    include: { patientRef: true, practitioner: true },
  });

  const { sendNotification, createBookingAppointment } = await import(
    "@/integration/control-plane-platform.client"
  );

  let sent = 0;
  for (const appt of appointments) {
    const phone = appt.patientRef.phone?.trim();
    if (!phone) continue;

    await sendNotification(
      {
        templateKey: "clinic.appointment.reminder",
        channel: "WHATSAPP",
        messageClass: "TRANSACTIONAL",
        recipient: phone,
        sourceEntityType: "appointment",
        sourceEntityId: appt.id,
        body: `Напоминание: приём ${appt.scheduledAt.toISOString()} — ${appt.practitioner.fullName}`,
        payload: {
          scheduledAt: appt.scheduledAt.toISOString(),
          practitionerName: appt.practitioner.fullName,
        },
      },
      { organizationId },
    );

    await createBookingAppointment(
      {
        customerRef: appt.patientRef.refCode,
        customerPhone: phone,
        customerName: appt.patientRef.fullName,
        scheduledAt: appt.scheduledAt.toISOString(),
        resourceKey: appt.practitioner.code,
        metadata: { appointmentId: appt.id },
      },
      { organizationId },
    ).catch(() => undefined);

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSentAt: new Date() },
    });
    sent++;
  }

  return { scanned: appointments.length, sent };
}

export async function listNurseSheetFormOptions(organizationId: string) {
  const [procedures, inactiveDepts] = await Promise.all([
    prisma.procedureType.findMany({
      where: { organizationId, active: true },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceDepartment.findMany({
      where: { organizationId, active: false },
      select: { code: true },
    }),
  ]);
  const off = new Set(inactiveDepts.map((row) => row.code));
  const catalog = off.size
    ? await prisma.serviceCatalogCache.findMany({
        where: { organizationId, code: { in: procedures.map((row) => row.code) } },
        select: { code: true, departmentCode: true },
      })
    : [];
  const hidden = new Set(
    catalog.filter((row) => row.departmentCode && off.has(row.departmentCode)).map((row) => row.code),
  );
  return procedures.filter((row) => !hidden.has(row.code));
}
