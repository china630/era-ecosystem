import { prisma } from "@/lib/prisma";
import { validateProcedureCompatibility } from "@/lib/procedure-compatibility.service";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { hasProcedureSameDay, nextWorkSlot, skipLunch } from "@/lib/treatment-planner.service";

const LUNCH_END_HOUR = 14;

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export async function rescheduleProcedureOrder(
  orderId: string,
  scheduledAt: Date,
): Promise<{ id: string; scheduledAt: Date; endsAt: Date | null }> {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: { resourceBooking: true, procedureType: true },
  });
  if (!order) throw new Error("Procedure not found");
  if (!["SCHEDULED", "IN_PROGRESS"].includes(order.status)) {
    throw new Error("Only scheduled procedures can be rescheduled");
  }

  const duration =
    order.endsAt && order.scheduledAt
      ? Math.max(
          5,
          Math.round(
            (order.endsAt.getTime() - order.scheduledAt.getTime()) / 60_000,
          ),
        )
      : (order.procedureType?.durationMin ?? 5);

  let slotStart = await nextWorkSlot(new Date(scheduledAt));
  if (order.procedureType && !order.procedureType.afterLunchAllowed) {
    if (slotStart.getHours() >= LUNCH_END_HOUR) {
      throw new Error("Procedure cannot be scheduled after lunch");
    }
  }
  slotStart = skipLunch(slotStart);
  const slotEnd = addMinutes(slotStart, duration);

  if (
    await hasProcedureSameDay(
      order.patientRefId,
      order.procedureCode,
      slotStart,
      order.id,
    )
  ) {
    throw new Error("Same procedure already scheduled for this day");
  }

  if (order.resourceId) {
    const bookings = await prisma.resourceBooking.findMany({
      where: {
        resourceId: order.resourceId,
        startsAt: { lt: slotEnd },
        endsAt: { gt: slotStart },
        NOT: order.resourceBooking ? { id: order.resourceBooking.id } : undefined,
      },
    });
    const resource = await prisma.resource.findUnique({
      where: { id: order.resourceId },
    });
    if (resource && bookings.length >= resource.capacity) {
      throw new Error("Resource conflict at selected time");
    }
  }

  const sameDayStart = new Date(slotStart);
  sameDayStart.setHours(0, 0, 0, 0);
  const sameDayEnd = new Date(sameDayStart);
  sameDayEnd.setDate(sameDayEnd.getDate() + 1);

  const sameDayOrders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: order.patientRefId,
      scheduledAt: { gte: sameDayStart, lt: sameDayEnd },
      status: { not: "CANCELLED" },
      id: { not: order.id },
    },
  });
  const compatViolations = await validateProcedureCompatibility({
    candidateCode: order.procedureCode,
    startAt: slotStart,
    endAt: slotEnd,
    existing: sameDayOrders.map((o) => ({
      procedureCode: o.procedureCode,
      startAt: o.scheduledAt,
      endAt: o.endsAt ?? addMinutes(o.scheduledAt, duration),
    })),
  });
  if (compatViolations.length > 0) {
    throw new Error(compatViolations.map((v) => v.message).join("; "));
  }

  const updated = await prisma.procedureOrder.update({
    where: { id: orderId },
    data: { scheduledAt: slotStart, endsAt: slotEnd },
  });

  if (order.resourceBooking) {
    await prisma.resourceBooking.update({
      where: { id: order.resourceBooking.id },
      data: { startsAt: slotStart, endsAt: slotEnd },
    });
  }

  return updated;
}

export async function getResourceCalendar(date: Date) {
  const { schedulingSlotMinutes } = await getSchedulingSettings();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const resources = await prisma.resource.findMany({ orderBy: { code: "asc" } });
  const bookings = await prisma.resourceBooking.findMany({
    where: {
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    include: {
      procedureOrder: { include: { patientRef: true } },
    },
  });

  return resources.map((resource) => {
    const resourceBookings = bookings.filter((b) => b.resourceId === resource.id);
    const slots: Array<{
      time: string;
      occupied: boolean;
      procedureOrderId?: string;
      patientName?: string;
      procedureName?: string;
    }> = [];
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += schedulingSlotMinutes) {
        if (h === 13 && m < 60) continue;
        const slotStart = new Date(dayStart);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = addMinutes(slotStart, schedulingSlotMinutes);
        const hit = resourceBookings.find(
          (b) => b.startsAt < slotEnd && b.endsAt > slotStart,
        );
        slots.push({
          time: slotStart.toISOString(),
          occupied: Boolean(hit),
          procedureOrderId: hit?.procedureOrderId ?? undefined,
          patientName: hit?.procedureOrder?.patientRef.fullName,
          procedureName: hit?.procedureOrder?.procedureName,
        });
      }
    }
    return { resourceId: resource.id, code: resource.code, name: resource.name, slots };
  });
}
