import { prisma } from "@/lib/prisma";
import {
  getSchedulingSettings,
  isClosedWeekday,
} from "@/domain/settings/scheduling-settings";
import { isElectiveSchedulingAllowed } from "@/lib/production-calendar";
import {
  intervalsCover,
  resolveManyDayIntervals,
} from "@/domain/appointment/practitioner-schedule.service";

const BAKU_OFFSET = "+04:00";
const DEFAULT_SLOT_MINUTES = 30;

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
  resources: PractitionerCalendarRow[];
}> {
  const dateYmd = bakuYmd(dayInput);
  const settings = await getSchedulingSettings();
  const gridMinutes = DEFAULT_SLOT_MINUTES;
  const {
    dayStartHour,
    dayEndHour,
    lunchStartHour,
    lunchEndHour,
    closedWeekdays,
  } = settings;

  const noonBaku = new Date(`${dateYmd}T12:00:00${BAKU_OFFSET}`);
  if (isClosedWeekday(noonBaku, closedWeekdays)) {
    return { date: dateYmd, slotMinutes: gridMinutes, resources: [] };
  }
  if (!(await isElectiveSchedulingAllowed(noonBaku))) {
    return { date: dateYmd, slotMinutes: gridMinutes, resources: [] };
  }

  const dayStart = bakuSlotStart(dateYmd, 0, 0);
  const dayEnd = addMinutes(bakuSlotStart(dateYmd, 23, 59), 1);

  const gridSlots: Array<{ start: Date; end: Date; lunch: boolean; startMin: number }> = [];
  for (let h = dayStartHour; h < dayEndHour; h++) {
    for (let m = 0; m < 60; m += gridMinutes) {
      const start = bakuSlotStart(dateYmd, h, m);
      const end = addMinutes(start, gridMinutes);
      const lunch = h >= lunchStartHour && h < lunchEndHour;
      gridSlots.push({ start, end, lunch, startMin: h * 60 + m });
    }
  }

  const practitioners = await prisma.practitioner.findMany({
    where: { active: true },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      code: true,
      fullName: true,
      defaultSlotMinutes: true,
    },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      practitionerId: { in: practitioners.map((p) => p.id) },
    },
    include: {
      patientRef: { select: { id: true, refCode: true, fullName: true } },
      visit: { select: { id: true, status: true } },
      practitioner: { select: { code: true, defaultSlotMinutes: true } },
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
    const slotMinutes = p.defaultSlotMinutes || gridMinutes;
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
        const aEnd = new Date(
          aStart.getTime() + (a.practitioner.defaultSlotMinutes || slotMinutes) * 60_000,
        );
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
        hit.scheduledAt.getTime() +
          (hit.practitioner.defaultSlotMinutes || slotMinutes) * 60_000,
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
        practitionerCode: p.code,
      };
    });

    return {
      resourceId: p.id,
      code: p.code,
      name: p.fullName,
      slotMinutes,
      slots,
    };
  });

  return { date: dateYmd, slotMinutes: gridMinutes, resources };
}
