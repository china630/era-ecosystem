import { prisma } from "@/lib/prisma";
import { listClinicDays } from "@/domain/planning/clinic-day";
import { addBakuDays, bakuDateKey, bakuDayBounds } from "@/lib/baku-day";
import { dailyCapForQuota, loadEpisodeDailyCaps } from "@/domain/sanatorium/block-daily-cap";
import {
  alignDurationToSlotMinutes,
  getSchedulingSettings,
  getTenantWorkHours,
  resolveEffectiveDayEndHour,
} from "@/domain/settings/scheduling-settings";
import { cabinMatchesGuest } from "@/domain/procedure/resource-sex";
import { replaceProcedureAllocations } from "@/domain/procedure/procedure-allocation.service";
import type { RotationContextSlot } from "@/lib/procedure-rotation.service";
import {
  evaluateCandidateSlot,
  type PlacementFailureReason,
  type ScanAllocation,
  type ScanOrder,
  type ScanPatientSlot,
  type ScanStaff,
} from "@/lib/procedure-slot-scan";

export class SlotDecisionError extends Error {
  name = "SlotDecisionError";
  code: string;
  reason: PlacementFailureReason;

  constructor(reason: PlacementFailureReason, message?: string) {
    super(message ?? SLOT_REASON_MESSAGE[reason] ?? reason);
    this.reason = reason;
    this.code = reason.toUpperCase();
  }
}

export const SLOT_REASON_MESSAGE: Record<PlacementFailureReason, string> = {
  no_cabin: "No matching cabin for this procedure",
  cabin_sex: "Cabin sex does not match the guest",
  no_staff: "No staff posted for this procedure on that day",
  staff_busy: "Staff is busy at the selected time",
  cabin_busy: "Resource conflict at selected time",
  day_full: "the daily limit for this package block is used up",
  same_day: "Same procedure already scheduled for this day",
  closed: "Clinic is closed on that day",
  lunch: "Procedure cannot be scheduled in the lunch break",
  cross_day: "Manual move must stay on the same day",
  rule: "Procedure rule or rest gap conflict",
  no_slot: "Selected time is outside working hours",
};

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

/**
 * Accept this minute or refuse. Does not hunt the next free slot.
 */
export async function placeManualProcedureSlot(input: {
  orderId: string;
  scheduledAt: Date;
  resourceId?: string | null;
}): Promise<{ id: string; scheduledAt: Date; endsAt: Date | null; resourceId: string | null }> {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: input.orderId },
    include: {
      procedureType: { include: { requirements: true } },
      patientRef: { select: { sex: true } },
    },
  });
  if (!order) throw new Error("Procedure not found");
  if (order.status !== "SCHEDULED") {
    throw new Error("Only SCHEDULED procedures can be rescheduled");
  }
  if (input.scheduledAt.getTime() < Date.now()) {
    throw new Error("Cannot reschedule into the past");
  }

  const originYmd = bakuDateKey(order.scheduledAt);
  const targetYmd = bakuDateKey(input.scheduledAt);
  if (targetYmd !== originYmd) {
    throw new SlotDecisionError("cross_day");
  }

  const clinicDays = await listClinicDays(targetYmd, addBakuDays(targetYmd, 1));
  if (clinicDays[0] && !clinicDays[0].working) {
    throw new SlotDecisionError("closed");
  }

  const settings = await getSchedulingSettings();
  const workHours = await getTenantWorkHours();
  const slotMinutes = settings.schedulingSlotMinutes;
  const dailyCaps = order.clinicalEpisodeId
    ? await loadEpisodeDailyCaps(order.clinicalEpisodeId)
    : null;
  const capFields =
    order.inPackage && dailyCaps
      ? dailyCapForQuota(dailyCaps, order.packageQuotaCode, order.procedureCode)
      : { quotaKey: order.procedureCode, dailyCap: null as number | null };
  const pt = order.procedureType ?? (await prisma.procedureType.findFirst({
    where: { code: order.procedureCode },
    include: { requirements: true },
  }));
  if (!pt) throw new SlotDecisionError("no_slot");

  const duration =
    order.endsAt && order.scheduledAt
      ? Math.max(
          5,
          Math.round((order.endsAt.getTime() - order.scheduledAt.getTime()) / 60_000),
        )
      : alignDurationToSlotMinutes(pt.durationMin ?? slotMinutes, slotMinutes);
  const slotStart = input.scheduledAt;
  const slotEnd = addMinutes(slotStart, duration);

  const physicalReq = pt.requirements?.find(
    (req) => req.role === "LOCATION" || req.role === "EQUIPMENT",
  );
  const physicalRole: "LOCATION" | "EQUIPMENT" =
    physicalReq?.role === "LOCATION"
      ? "LOCATION"
      : physicalReq?.role === "EQUIPMENT"
        ? "EQUIPMENT"
        : pt.resourceKind === "ROOM"
          ? "LOCATION"
          : "EQUIPMENT";
  const codes = new Set<string>();
  for (const req of pt.requirements ?? []) {
    if (req.role !== "LOCATION" && req.role !== "EQUIPMENT") continue;
    const code = req.resourceCode?.trim();
    if (code) codes.add(code);
  }
  if (codes.size === 0 && pt.resourceCode?.trim()) codes.add(pt.resourceCode.trim());
  const resourceRows = codes.size
    ? await prisma.resource.findMany({ where: { code: { in: [...codes] } } })
    : [];
  const guestSex = order.patientRef.sex ?? null;
  const matching = resourceRows.filter((row) => cabinMatchesGuest(row.sexAudience, guestSex));
  if (resourceRows.length > 0 && matching.length === 0) {
    throw new SlotDecisionError("cabin_sex");
  }

  const staffReq =
    pt.requirements?.find((req) => req.role === "STAFF" && req.staffMode === "SOFT") ??
    pt.requirements?.find((req) => req.role === "STAFF");
  const typeHours = {
    ...workHours,
    dayStartHour: pt.dayStartHour ?? workHours.dayStartHour,
    dayEndHour: pt.dayEndHour ?? workHours.dayEndHour,
  };
  const scanOrder: ScanOrder = {
    id: order.id,
    organizationId: order.organizationId,
    procedureCode: order.procedureCode,
    procedureName: order.procedureName?.trim() || order.procedureCode,
    bodyPart: order.bodyPart ?? pt.bodyPart ?? null,
    inPackage: order.inPackage === true,
    ...capFields,
    durationMin: duration,
    dayEndHour: resolveEffectiveDayEndHour(typeHours, {
      procedureExtendedEndHour: pt.extendedEndHour,
      resourceExtendedEndHour: matching[0]?.extendedEndHour,
    }),
    patientRestMinutes: pt.patientRestMinutes ?? 15,
    resourceGapMinutes: pt.resourceGapMinutes ?? 5,
    afterLunchAllowed: pt.afterLunchAllowed ?? true,
    beforeLunchAllowed: pt.beforeLunchAllowed ?? true,
    typeHours,
    physicalRole,
    resources: matching.map((row) => ({
      id: row.id,
      capacity: row.capacity,
      role: physicalRole,
    })),
    staffMode: staffReq?.staffMode === "SOFT" ? "SOFT" : "HARD",
    procedureTypeId: pt.id,
    pinYmd: targetYmd,
  };

  const existing = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: order.patientRefId,
      status: { notIn: ["CANCELLED", "PROPOSED", "PENDING_PAY"] },
      id: { not: order.id },
    },
    select: {
      status: true,
      procedureCode: true,
      bodyPart: true,
      scheduledAt: true,
      endsAt: true,
      inPackage: true,
      packageQuotaCode: true,
      procedureType: { select: { patientRestMinutes: true } },
    },
  });
  const patientSlots: ScanPatientSlot[] = existing.map((row) => ({
    code: row.procedureCode,
    bodyPart: row.bodyPart,
    start: row.scheduledAt,
    end: row.endsAt ?? row.scheduledAt,
    patientRestMinutes: row.procedureType?.patientRestMinutes ?? 15,
    inPackage: row.inPackage === true,
    quotaKey: dailyCaps
      ? dailyCapForQuota(dailyCaps, row.packageQuotaCode, row.procedureCode).quotaKey
      : row.procedureCode,
    countsForRest: row.status !== "NO_SHOW",
  }));
  const rotationContext: RotationContextSlot[] = existing
    .filter((row) => row.status !== "NO_SHOW")
    .map((row) => ({
      procedureCode: row.procedureCode,
      bodyPart: row.bodyPart,
      startAt: row.scheduledAt,
      endAt: row.endsAt ?? row.scheduledAt,
    }));

  const { loadStaffByDayForScan, loadOccupancyForScan } = await import(
    "@/lib/treatment-planner.service"
  );
  const staffByTypeAndYmd = await loadStaffByDayForScan([pt.id], targetYmd, addBakuDays(targetYmd, 1));
  const staffIds = [...new Set([...staffByTypeAndYmd.values()].flat().map((person) => person.id))];
  const resourceIds = scanOrder.resources.map((row) => row.id);
  const allocations: ScanAllocation[] = await loadOccupancyForScan(
    resourceIds,
    staffIds,
    targetYmd,
    addBakuDays(targetYmd, 1),
  );

  const [rules, rotationRules, compatibilityRules] = await Promise.all([
    prisma.procedureRule.findMany(),
    prisma.procedureRotationRule.findMany({ where: { active: true } }),
    prisma.procedureCompatibilityRule.findMany({ where: { active: true } }),
  ]);

  const requiredResourceId = input.resourceId ?? order.resourceId;
  const verdict = evaluateCandidateSlot({
    order: scanOrder,
    slotStart,
    slotEnd,
    packageCap: 12,
    closedYmds: new Set(clinicDays.filter((day) => !day.working).map((day) => day.ymd)),
    staffByTypeAndYmd,
    rules,
    rotationRules,
    compatibilityRules,
    patientSlots,
    rotationContext,
    allocations,
    requiredResourceId,
  });
  if (!verdict.ok) {
    throw new SlotDecisionError(verdict.reason);
  }

  const updated = await prisma.procedureOrder.update({
    where: { id: order.id },
    data: {
      scheduledAt: slotStart,
      endsAt: slotEnd,
      resourceId: verdict.resource.id,
    },
  });
  await replaceProcedureAllocations(order.id, [
    {
      role: physicalRole,
      resourceId: verdict.resource.id,
      startsAt: slotStart,
      endsAt: slotEnd,
    },
    {
      role: "STAFF",
      practitionerId: verdict.staff.id,
      startsAt: slotStart,
      endsAt: slotEnd,
    },
  ]);
  return updated;
}

export async function clinicDayIsClosed(ymd: string): Promise<boolean> {
  const days = await listClinicDays(ymd, addBakuDays(ymd, 1));
  return Boolean(days[0] && !days[0].working);
}
