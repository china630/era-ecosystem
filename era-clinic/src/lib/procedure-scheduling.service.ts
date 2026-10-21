import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { clinicDayIsClosed, placeManualProcedureSlot } from "@/domain/planning/slot-decision";
import { allocationOccupiesCandidate } from "@/domain/procedure/resource-occupancy";
import { bakuDateKey, bakuDayBounds, parseBakuDateTime } from "@/lib/baku-day";

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export async function rescheduleProcedureOrder(
  orderId: string,
  scheduledAt: Date,
  opts?: { resourceId?: string; allowOtherDay?: boolean },
): Promise<{ id: string; scheduledAt: Date; endsAt: Date | null; resourceId: string | null }> {
  return placeManualProcedureSlot({
    orderId,
    scheduledAt,
    resourceId: opts?.resourceId,
    allowOtherDay: opts?.allowOtherDay,
  });
}

export async function getResourceCalendar(date: Date, opts?: { procedureCode?: string }) {
  const settings = await getSchedulingSettings();
  const schedulingSlotMinutes = settings.schedulingSlotMinutes;
  const dayYmd = bakuDateKey(date);
  if (await clinicDayIsClosed(dayYmd)) {
    return [];
  }
  const { start: dayStart, end: dayEnd } = bakuDayBounds(dayYmd);

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
  const [bookings, allocations] = await Promise.all([
    prisma.resourceBooking.findMany({
      where: {
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      include: {
        procedureOrder: { include: { patientRef: true, procedureType: { select: { resourceGapMinutes: true } } } },
      },
    }),
    prisma.procedureAllocation.findMany({
      where: {
        role: { in: ["LOCATION", "EQUIPMENT"] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: new Date(dayStart.getTime() - 240 * 60_000) },
        procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED"] } },
      },
      include: {
        procedureOrder: {
          include: { patientRef: true, procedureType: { select: { resourceGapMinutes: true } } },
        },
      },
    }),
  ]);

  const bookingResourceIds = new Set(bookings.map((b) => b.resourceId));
  const resources = allResources.filter((resource) => {
    if (procedureResourceCodes) {
      return procedureResourceCodes.has(resource.code);
    }
    return schedulingCodes.has(resource.code) || bookingResourceIds.has(resource.id);
  });

  return resources.map((resource) => {
    const resourceBookings = bookings.filter((b) => b.resourceId === resource.id);
    const resourceAllocations = allocations.filter((row) => row.resourceId === resource.id);
    const slots: Array<{
      time: string;
      occupied: boolean;
      procedureOrderId?: string;
      patientName?: string;
      procedureName?: string;
      lunch?: boolean;
    }> = [];
    const startHour = settings.dayStartHour;
    const endHour = settings.dayEndHour;
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += schedulingSlotMinutes) {
        const inLunch = h >= settings.lunchStartHour && h < settings.lunchEndHour;
        const slotStart = parseBakuDateTime(
          dayYmd,
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        );
        const slotEnd = addMinutes(slotStart, schedulingSlotMinutes);
        const proof = resourceBookings.find((b) => {
          const status = b.procedureOrder?.status;
          const keep = status === "NO_SHOW" || !b.procedureOrderId;
          return keep && b.startsAt < slotEnd && b.endsAt > slotStart;
        });
        const held = resourceAllocations.find((row) =>
          allocationOccupiesCandidate(
            row.startsAt,
            row.endsAt,
            row.procedureOrder.procedureType?.resourceGapMinutes ?? 5,
            slotStart,
            slotEnd,
          ),
        );
        const order = held?.procedureOrder ?? proof?.procedureOrder;
        slots.push({
          time: slotStart.toISOString(),
          occupied: Boolean(held || proof),
          lunch: !held && !proof && inLunch,
          procedureOrderId: order?.id ?? proof?.procedureOrderId ?? undefined,
          patientName: order?.patientRef.fullName,
          procedureName: order?.procedureName,
        });
      }
    }
    return { resourceId: resource.id, code: resource.code, name: resource.name, slots };
  });
}
