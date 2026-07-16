import { prisma } from "@/lib/prisma";
import {
  isElectiveSchedulingAllowed,
  resolveSchedulingEndHour,
} from "@/lib/production-calendar";

const WORK_START = 9;
const DEFAULT_SLOT_MINUTES = 30;

export async function slotTimesForDay(day: Date, slotMinutes: number): Promise<Date[]> {
  const allowed = await isElectiveSchedulingAllowed(day);
  if (!allowed) return [];

  const workEnd = await resolveSchedulingEndHour(day);
  const slots: Date[] = [];
  const base = new Date(day);
  base.setHours(0, 0, 0, 0);
  for (let h = WORK_START; h < workEnd; h++) {
    for (let m = 0; m < 60; m += slotMinutes) {
      const t = new Date(base);
      t.setHours(h, m, 0, 0);
      if (t.getHours() >= workEnd) break;
      slots.push(t);
    }
  }
  return slots;
}

async function resolveSlotMinutes(practitionerCode?: string): Promise<number> {
  if (!practitionerCode) return DEFAULT_SLOT_MINUTES;
  const practitioner = await prisma.practitioner.findUnique({
    where: { code: practitionerCode },
    select: { defaultSlotMinutes: true },
  });
  return practitioner?.defaultSlotMinutes ?? DEFAULT_SLOT_MINUTES;
}

export async function getAvailableSlots(input: {
  date: Date;
  practitionerCode?: string;
  resourceCode?: string;
}) {
  const slotMinutes = await resolveSlotMinutes(input.practitionerCode);
  const day = new Date(input.date);
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const slots = await slotTimesForDay(day, slotMinutes);
  if (slots.length === 0) {
    return {
      slotMinutes,
      slots: [],
      meta: { conflictCount: 0, electiveBlocked: true },
    };
  }

  const [appointments, resourceBookings] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: day, lt: nextDay },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(input.practitionerCode
          ? { practitioner: { code: input.practitionerCode } }
          : {}),
      },
      select: { id: true, scheduledAt: true },
    }),
    prisma.resourceBooking.findMany({
      where: {
        startsAt: { lt: nextDay },
        endsAt: { gt: day },
        ...(input.resourceCode
          ? { resource: { code: input.resourceCode } }
          : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const appointmentByTime = new Map<number, string>();
  const taken = new Set<number>();
  for (const a of appointments) {
    taken.add(a.scheduledAt.getTime());
    appointmentByTime.set(a.scheduledAt.getTime(), a.id);
  }
  for (const b of resourceBookings) {
    for (const slot of slots) {
      if (slot >= b.startsAt && slot < b.endsAt) taken.add(slot.getTime());
    }
  }

  const conflicts = appointments.length + resourceBookings.length;

  return {
    slotMinutes,
    slots: slots.map((slotAt) => ({
      time: slotAt.toISOString(),
      label: slotAt.toTimeString().slice(0, 5),
      available: !taken.has(slotAt.getTime()),
      appointmentId: appointmentByTime.get(slotAt.getTime()) ?? null,
    })),
    meta: { conflictCount: conflicts },
  };
}

export async function detectSchedulingConflict(input: {
  practitionerCode: string;
  scheduledAt: Date;
  excludeAppointmentId?: string;
}): Promise<string | null> {
  const slotMinutes = await resolveSlotMinutes(input.practitionerCode);
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + slotMinutes * 60_000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
      practitioner: { code: input.practitionerCode },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      scheduledAt: { gte: start, lt: end },
    },
    select: { id: true },
  });
  if (conflict) return "Practitioner already booked at this time";
  return null;
}
