import { prisma } from "@/lib/prisma";
import { validateProcedureCompatibility } from "@/lib/procedure-compatibility.service";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  hasProcedureSameDay,
  nextWorkSlot,
  skipLunch,
  validatePatientConsecutiveGap,
} from "@/lib/treatment-planner.service";
import { countResourceAllocations } from "@/domain/procedure/procedure-allocation.service";

const LUNCH_END_HOUR = 14;

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export async function rescheduleProcedureOrder(
  orderId: string,
  scheduledAt: Date,
  opts?: { resourceId?: string },
): Promise<{ id: string; scheduledAt: Date; endsAt: Date | null; resourceId: string | null }> {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: { resourceBooking: true, procedureType: true },
  });
  if (!order) throw new Error("Procedure not found");
  if (order.status !== "SCHEDULED") {
    throw new Error("Only SCHEDULED procedures can be rescheduled");
  }

  const targetResourceId = opts?.resourceId ?? order.resourceId;

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

  if (targetResourceId) {
    const used = await countResourceAllocations(
      targetResourceId,
      slotStart,
      slotEnd,
      order.id,
    );
    const resource = await prisma.resource.findUnique({
      where: { id: targetResourceId },
    });
    if (resource && used >= resource.capacity) {
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
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
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

  const gapErr = await validatePatientConsecutiveGap({
    patientRefId: order.patientRefId,
    startAt: slotStart,
    endAt: slotEnd,
    excludeOrderId: order.id,
    candidatePatientRestMinutes: order.procedureType?.patientRestMinutes ?? 15,
  });
  if (gapErr) throw new Error(gapErr);

  const updated = await prisma.procedureOrder.update({
    where: { id: orderId },
    data: {
      scheduledAt: slotStart,
      endsAt: slotEnd,
      ...(targetResourceId ? { resourceId: targetResourceId } : {}),
    },
  });

  if (order.resourceBooking && targetResourceId) {
    await prisma.resourceBooking.update({
      where: { id: order.resourceBooking.id },
      data: {
        startsAt: slotStart,
        endsAt: slotEnd,
        resourceId: targetResourceId,
      },
    });
  } else if (!order.resourceBooking && targetResourceId) {
    await prisma.resourceBooking.create({
      data: {
        resourceId: targetResourceId,
        procedureOrderId: order.id,
        startsAt: slotStart,
        endsAt: slotEnd,
      },
    });
  }

  return updated;
}

export async function getResourceCalendar(date: Date, opts?: { procedureCode?: string }) {
  const { schedulingSlotMinutes } = await getSchedulingSettings();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const schedulingCodes = new Set(
    (
      await prisma.procedureTypeRequirement.findMany({
        where: {
          role: { in: ["LOCATION", "EQUIPMENT"] },
          resourceCode: { not: null },
        },
        select: { resourceCode: true },
      })
    )
      .map((r) => r.resourceCode)
      .filter(Boolean) as string[],
  );

  let procedureResourceCodes: Set<string> | null = null;
  if (opts?.procedureCode) {
    const pt = await prisma.procedureType.findFirst({
      where: { code: opts.procedureCode },
      include: { requirements: true },
    });
    if (pt) {
      const { listPhysicalRequirementResources } = await import(
        "@/domain/procedure/procedure-allocation.service"
      );
      const resources = await listPhysicalRequirementResources(pt);
      procedureResourceCodes = new Set(resources.map((r) => r.code));
    }
  }

  const allResources = await prisma.resource.findMany({ orderBy: { code: "asc" } });
  const bookings = await prisma.resourceBooking.findMany({
    where: {
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    include: {
      procedureOrder: { include: { patientRef: true } },
    },
  });

  const bookingResourceIds = new Set(bookings.map((b) => b.resourceId));
  const resources = allResources.filter((resource) => {
    if (procedureResourceCodes) {
      return procedureResourceCodes.has(resource.code);
    }
    return schedulingCodes.has(resource.code) || bookingResourceIds.has(resource.id);
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
