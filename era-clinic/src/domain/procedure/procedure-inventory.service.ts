import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { validateProcedureCompatibility } from "@/lib/procedure-compatibility.service";
import {
  hasProcedureSameDay,
  nextWorkSlot,
  skipLunch,
  validatePatientConsecutiveGap,
} from "@/lib/treatment-planner.service";
import { getResourceCalendar } from "@/lib/procedure-scheduling.service";
import { countResourceAllocations } from "@/domain/procedure/procedure-allocation.service";
import { bakuDateKey, bakuDayBounds, bakuHourMinute } from "@/lib/baku-day";

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

const LUNCH_END_HOUR = 14;

/**
 * Free slots for a resource (hotel inventory style).
 * Exhausted / conflicted slots are omitted — never offered in pickers.
 */
export async function listAvailableResourceSlots(input: {
  date: Date;
  resourceId?: string;
  procedureCode?: string;
  patientRefId?: string;
  excludeOrderId?: string;
  durationMin?: number;
}) {
  const { schedulingSlotMinutes } = await getSchedulingSettings();
  const dayYmd = bakuDateKey(input.date);
  const { start: dayStart } = bakuDayBounds(dayYmd);

  const calendar = await getResourceCalendar(dayStart, {
    procedureCode: input.procedureCode,
  });
  const resources = input.resourceId
    ? calendar.filter((r) => r.resourceId === input.resourceId)
    : calendar;

  const procedureType = input.procedureCode
    ? await prisma.procedureType.findFirst({ where: { code: input.procedureCode } })
    : null;
  const duration = input.durationMin ?? procedureType?.durationMin ?? schedulingSlotMinutes;

  const out: Array<{
    resourceId: string;
    resourceCode: string;
    resourceName: string;
    startsAt: string;
    endsAt: string;
  }> = [];

  for (const row of resources) {
    const capacity =
      (await prisma.resource.findUnique({ where: { id: row.resourceId } }))?.capacity ?? 1;

    for (const slot of row.slots) {
      if (slot.occupied) continue;
      const slotStart = await nextWorkSlot(new Date(slot.time));
      if (procedureType && !procedureType.afterLunchAllowed && bakuHourMinute(slotStart).hour >= LUNCH_END_HOUR) {
        continue;
      }
      const adjusted = skipLunch(slotStart);
      const slotEnd = addMinutes(adjusted, duration);

      const overlapping = await countResourceAllocations(
        row.resourceId,
        adjusted,
        slotEnd,
        input.excludeOrderId,
      );
      if (overlapping >= capacity) continue;

      if (input.patientRefId && input.procedureCode) {
        if (
          await hasProcedureSameDay(
            input.patientRefId,
            input.procedureCode,
            adjusted,
            input.excludeOrderId,
          )
        ) {
          continue;
        }
        const { start: sameDayStart, end: sameDayEnd } = bakuDayBounds(bakuDateKey(adjusted));
        const sameDayOrders = await prisma.procedureOrder.findMany({
          where: {
            patientRefId: input.patientRefId,
            scheduledAt: { gte: sameDayStart, lt: sameDayEnd },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            id: input.excludeOrderId ? { not: input.excludeOrderId } : undefined,
          },
        });
        const violations = await validateProcedureCompatibility({
          candidateCode: input.procedureCode,
          startAt: adjusted,
          endAt: slotEnd,
          existing: sameDayOrders.map((o) => ({
            procedureCode: o.procedureCode,
            startAt: o.scheduledAt,
            endAt: o.endsAt ?? addMinutes(o.scheduledAt, duration),
          })),
        });
        if (violations.length > 0) continue;

        const gapErr = await validatePatientConsecutiveGap({
          patientRefId: input.patientRefId,
          startAt: adjusted,
          endAt: slotEnd,
          excludeOrderId: input.excludeOrderId,
          candidatePatientRestMinutes: procedureType?.patientRestMinutes ?? 15,
        });
        if (gapErr) continue;
      }

      out.push({
        resourceId: row.resourceId,
        resourceCode: row.code,
        resourceName: row.name,
        startsAt: adjusted.toISOString(),
        endsAt: slotEnd.toISOString(),
      });
    }
  }

  return out;
}

export async function getResourceDayMatrix(date: Date) {
  const calendar = await getResourceCalendar(date);
  const orderIds = calendar
    .flatMap((r) => r.slots.map((s) => s.procedureOrderId))
    .filter(Boolean) as string[];
  const orders =
    orderIds.length > 0
      ? await prisma.procedureOrder.findMany({
          where: { id: { in: [...new Set(orderIds)] } },
          select: {
            id: true,
            status: true,
            patientRefId: true,
            procedureCode: true,
            manuallyAdjusted: true,
          },
        })
      : [];
  const byId = new Map(orders.map((o) => [o.id, o]));

  return {
    date: bakuDateKey(date),
    resources: calendar.map((r) => ({
      ...r,
      slots: r.slots.map((s) => {
        const ord = s.procedureOrderId ? byId.get(s.procedureOrderId) : undefined;
        return {
          ...s,
          status: ord?.status,
          patientRefId: ord?.patientRefId,
          procedureCode: ord?.procedureCode,
          manuallyAdjusted: ord?.manuallyAdjusted,
          blocked: s.occupied,
        };
      }),
    })),
  };
}
