import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { validateProcedureCompatibility } from "@/lib/procedure-compatibility.service";
import {
  hasProcedureSameDay,
  validatePatientConsecutiveGap,
} from "@/lib/treatment-planner.service";
import { getResourceCalendar } from "@/lib/procedure-scheduling.service";
import { clinicDayIsClosed } from "@/domain/planning/slot-decision";
import { countResourceAllocations } from "@/domain/procedure/procedure-allocation.service";
import { cabinMatchesGuest } from "@/domain/procedure/resource-sex";
import { addBakuDays, bakuDateKey, bakuDayBounds } from "@/lib/baku-day";

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

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
  if (await clinicDayIsClosed(dayYmd)) return [];
  const { start: dayStart } = bakuDayBounds(dayYmd);

  const calendar = await getResourceCalendar(dayStart, {
    procedureCode: input.procedureCode,
  });
  let resources = input.resourceId
    ? calendar.filter((r) => r.resourceId === input.resourceId)
    : calendar;
  if (input.patientRefId && resources.length > 0) {
    const patient = await prisma.patientRef.findUnique({
      where: { id: input.patientRefId },
      select: { sex: true },
    });
    const rows = await prisma.resource.findMany({
      where: { id: { in: resources.map((row) => row.resourceId) } },
      select: { id: true, sexAudience: true },
    });
    const audience = new Map(rows.map((row) => [row.id, row.sexAudience]));
    resources = resources.filter((row) => cabinMatchesGuest(audience.get(row.resourceId), patient?.sex));
  }

  const procedureType = input.procedureCode
    ? await prisma.procedureType.findFirst({ where: { code: input.procedureCode } })
    : null;
  if (procedureType) {
    const { loadStaffByDayForScan } = await import("@/lib/treatment-planner.service");
    const staff = await loadStaffByDayForScan([procedureType.id], dayYmd, addBakuDays(dayYmd, 1));
    if ((staff.get(`${procedureType.id}|${dayYmd}`) ?? []).length === 0) return [];
  }
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
      if (slot.occupied || slot.lunch) continue;
      const slotStart = new Date(slot.time);
      if (bakuDateKey(slotStart) !== dayYmd) continue;
      const adjusted = slotStart;
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
            AND: [
              { status: { notIn: ["CANCELLED", "NO_SHOW", "UNPAID_MISSED"] } },
              {
                OR: [{ status: { not: "PENDING_PAY" } }, { resourceId: { not: null } }],
              },
            ],
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
  const dayYmd = bakuDateKey(date);
  const closed = await clinicDayIsClosed(dayYmd);
  if (closed) {
    return { date: dayYmd, closed: true, resources: [] as Awaited<ReturnType<typeof getResourceCalendar>> };
  }
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
            clinicalEpisode: { select: { roomNumber: true } },
          },
        })
      : [];
  const byId = new Map(orders.map((o) => [o.id, o]));

  return {
    date: bakuDateKey(date),
    closed: false,
    resources: calendar.map((r) => ({
      ...r,
      slots: r.slots.map((s) => {
        const ord = s.procedureOrderId ? byId.get(s.procedureOrderId) : undefined;
        return {
          ...s,
          status: ord?.status,
          patientRefId: ord?.patientRefId,
          roomNumber: ord?.clinicalEpisode?.roomNumber ?? undefined,
          procedureCode: ord?.procedureCode,
          manuallyAdjusted: ord?.manuallyAdjusted,
          blocked: s.occupied,
        };
      }),
    })),
  };
}
