import { prisma } from "@/lib/prisma";

const WORK_START = 9;
const WORK_END = 17;
const SLOT_MINUTES = 30;

export function slotTimesForDay(day: Date): Date[] {
  const slots: Date[] = [];
  const base = new Date(day);
  base.setHours(0, 0, 0, 0);
  for (let h = WORK_START; h < WORK_END; h++) {
    for (const m of [0, 30]) {
      const t = new Date(base);
      t.setHours(h, m, 0, 0);
      slots.push(t);
    }
  }
  return slots;
}

export async function getAvailableSlots(input: {
  date: Date;
  practitionerCode?: string;
  resourceCode?: string;
}) {
  const day = new Date(input.date);
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const [appointments, resourceBookings] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: day, lt: nextDay },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(input.practitionerCode
          ? { practitioner: { code: input.practitionerCode } }
          : {}),
      },
      select: { scheduledAt: true },
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

  const taken = new Set<number>();
  for (const a of appointments) taken.add(a.scheduledAt.getTime());
  for (const b of resourceBookings) {
    for (const slot of slotTimesForDay(day)) {
      if (slot >= b.startsAt && slot < b.endsAt) taken.add(slot.getTime());
    }
  }

  return slotTimesForDay(day).map((slotAt) => ({
    time: slotAt.toISOString(),
    label: slotAt.toTimeString().slice(0, 5),
    available: !taken.has(slotAt.getTime()),
  }));
}
