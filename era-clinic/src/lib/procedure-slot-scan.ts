import {
  inPackageCodesOnBakuDay,
  packageDayIsFullForNewCode,
} from "@/domain/sanatorium/daily-package-cap";
import { allocationOccupiesCandidate } from "@/domain/procedure/resource-occupancy";
import type { TenantWorkHours } from "@/domain/settings/scheduling-settings";
import {
  addBakuDays,
  bakuDateKey,
  bakuDayBounds,
  bakuHourMinute,
  parseBakuDateTime,
} from "@/lib/baku-day";
import { validateProcedureCompatibilityRules } from "@/lib/procedure-compatibility.service";
import {
  evaluateRotationRules,
  type RotationContextSlot,
} from "@/lib/procedure-rotation.service";

export type PlacementFailureReason =
  | "no_cabin"
  | "cabin_sex"
  | "no_staff"
  | "staff_busy"
  | "cabin_busy"
  | "day_full"
  | "rule"
  | "no_slot";

/** Next working-hour start. 14:36 with a 17:00 close becomes 15:00. After the close, next morning. */
export function nextSearchStart(now: Date, dayStartHour: number, dayEndHour: number): Date {
  const { hour } = bakuHourMinute(now);
  let next = hour + 1;
  let ymd = bakuDateKey(now);
  if (next >= dayEndHour) {
    next = dayStartHour;
    ymd = addBakuDays(ymd, 1);
  }
  if (next < dayStartHour) next = dayStartHour;
  return parseBakuDateTime(ymd, `${String(next).padStart(2, "0")}:00`);
}

export type ScanStaff = { id: string; fullName: string; code: string };

export type ScanResource = {
  id: string;
  capacity: number;
  role: "LOCATION" | "EQUIPMENT";
};

export type ScanAllocation = {
  role: "LOCATION" | "EQUIPMENT" | "STAFF";
  resourceId: string | null;
  practitionerId: string | null;
  startsAt: Date;
  endsAt: Date;
  procedureOrderId: string;
  resourceGapMinutes: number;
};

export type ScanPatientSlot = {
  code: string;
  bodyPart?: string | null;
  start: Date;
  end: Date;
  patientRestMinutes: number;
  inPackage: boolean;
  /** NO_SHOW blocks a second session the same day and does not create a rest gap. */
  countsForRest: boolean;
};

type ScanRule = {
  kind: string;
  beforeCode: string | null;
  afterCode: string | null;
  minGapMinutes: number | null;
};

type ScanRotationRule = Parameters<typeof evaluateRotationRules>[0]["rules"][number];
type ScanCompatRule = Parameters<typeof validateProcedureCompatibilityRules>[0]["rules"][number];

export type ScanOrder = {
  id: string;
  organizationId: string;
  procedureCode: string;
  procedureName: string;
  bodyPart: string | null;
  inPackage: boolean;
  durationMin: number;
  dayEndHour: number;
  patientRestMinutes: number;
  resourceGapMinutes: number;
  afterLunchAllowed: boolean;
  beforeLunchAllowed: boolean;
  typeHours: TenantWorkHours;
  physicalRole: "LOCATION" | "EQUIPMENT";
  resources: ScanResource[];
  staffMode: "HARD" | "SOFT";
  procedureTypeId: string;
};

export type PlannedPlacement = {
  orderId: string;
  organizationId: string;
  procedureCode: string;
  procedureName: string;
  bodyPart: string | null;
  slotStart: Date;
  slotEnd: Date;
  resourceId: string;
  physicalRole: "LOCATION" | "EQUIPMENT";
  staffId: string;
  patientRestMinutes: number;
  inPackage: boolean;
  resourceGapMinutes: number;
};

export type PlacementFailure = {
  orderId: string;
  procedureCode: string;
  procedureName: string;
  reason: PlacementFailureReason;
};

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

function bakuWallTime(ref: Date, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return parseBakuDateTime(bakuDateKey(ref), `${hh}:${mm}`);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function skipLunch(slot: Date, hours: TenantWorkHours): Date {
  const { hour: h } = bakuHourMinute(slot);
  if (h >= hours.lunchStartHour && h < hours.lunchEndHour) {
    return bakuWallTime(slot, hours.lunchEndHour);
  }
  return slot;
}

function avoidLunchOverlap(start: Date, durationMin: number, hours: TenantWorkHours): Date {
  const s = skipLunch(start, hours);
  const lunchStart = bakuWallTime(s, hours.lunchStartHour);
  const lunchEnd = bakuWallTime(s, hours.lunchEndHour);
  const end = new Date(s.getTime() + durationMin * 60_000);
  if (s.getTime() < lunchEnd.getTime() && end.getTime() > lunchStart.getTime()) {
    return bakuWallTime(s, hours.lunchEndHour);
  }
  return s;
}

function snapUpToSlot(cursor: Date, slotMinutes: number): Date {
  const step = Math.max(1, slotMinutes);
  const { hour, minute } = bakuHourMinute(cursor);
  const rem = minute % step;
  if (rem === 0) return bakuWallTime(cursor, hour, minute);
  const snapped = minute + (step - rem);
  if (snapped >= 60) {
    const nextHour = addMinutes(bakuWallTime(cursor, hour, 0), 60);
    const hm = bakuHourMinute(nextHour);
    return bakuWallTime(nextHour, hm.hour, 0);
  }
  return bakuWallTime(cursor, hour, snapped);
}

function nextOpenSlot(
  cursor: Date,
  hours: TenantWorkHours,
  dayEndHour: number,
  closed: Set<string>,
  horizonEndYmd: string,
  slotMinutes: number,
): Date | null {
  let d = snapUpToSlot(cursor, slotMinutes);
  for (let i = 0; i < 400; i++) {
    if (bakuDateKey(d) >= horizonEndYmd) return null;
    d = skipLunch(d, hours);
    if (bakuHourMinute(d).hour >= dayEndHour) {
      const nextYmd = addBakuDays(bakuDateKey(d), 1);
      d = bakuWallTime(bakuDayBounds(nextYmd).start, hours.dayStartHour);
      continue;
    }
    if (bakuHourMinute(d).hour < hours.dayStartHour) {
      d = bakuWallTime(d, hours.dayStartHour);
    }
    if (closed.has(bakuDateKey(d))) {
      const nextYmd = addBakuDays(bakuDateKey(d), 1);
      d = bakuWallTime(bakuDayBounds(nextYmd).start, hours.dayStartHour);
      continue;
    }
    return d;
  }
  return null;
}

function nextMorning(
  from: Date,
  hours: TenantWorkHours,
  dayEndHour: number,
  closed: Set<string>,
  horizonEndYmd: string,
  slotMinutes: number,
): Date | null {
  const nextYmd = addBakuDays(bakuDateKey(from), 1);
  const d = bakuWallTime(bakuDayBounds(nextYmd).start, hours.dayStartHour);
  return nextOpenSlot(d, hours, dayEndHour, closed, horizonEndYmd, slotMinutes);
}

function staffBusy(
  allocs: ScanAllocation[],
  practitionerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeOrderId: string,
): number {
  let count = 0;
  for (const row of allocs) {
    if (row.role !== "STAFF" || row.practitionerId !== practitionerId) continue;
    if (row.procedureOrderId === excludeOrderId) continue;
    if (row.startsAt < endsAt && row.endsAt > startsAt) count++;
  }
  return count;
}

function resourceUsed(
  allocs: ScanAllocation[],
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  excludeOrderId: string,
): number {
  let count = 0;
  for (const row of allocs) {
    if (row.role !== "LOCATION" && row.role !== "EQUIPMENT") continue;
    if (row.resourceId !== resourceId) continue;
    if (row.procedureOrderId === excludeOrderId) continue;
    if (
      allocationOccupiesCandidate(
        row.startsAt,
        row.endsAt,
        row.resourceGapMinutes,
        startsAt,
        endsAt,
      )
    ) {
      count++;
    }
  }
  return count;
}

function pickStaff(
  people: ScanStaff[],
  allocs: ScanAllocation[],
  startsAt: Date,
  endsAt: Date,
  orderId: string,
  mode: "HARD" | "SOFT",
): ScanStaff | null {
  if (people.length === 0) return null;
  if (mode === "SOFT") {
    let best = people[0]!;
    let bestBusy = Number.POSITIVE_INFINITY;
    for (const person of people) {
      const busy = staffBusy(allocs, person.id, startsAt, endsAt, orderId);
      if (busy < bestBusy) {
        best = person;
        bestBusy = busy;
        if (busy === 0) break;
      }
    }
    return best;
  }
  for (const person of people) {
    if (staffBusy(allocs, person.id, startsAt, endsAt, orderId) === 0) return person;
  }
  return null;
}

function sameProcedureThatDay(slots: ScanPatientSlot[], code: string, day: Date): boolean {
  const key = bakuDateKey(day);
  return slots.some((slot) => slot.code === code && bakuDateKey(slot.start) === key);
}

function restGap(
  slots: ScanPatientSlot[],
  startAt: Date,
  endAt: Date,
  restAfter: number,
): boolean {
  const key = bakuDateKey(startAt);
  const timeline = [
    ...slots
      .filter((slot) => slot.countsForRest && bakuDateKey(slot.start) === key)
      .map((slot) => ({
        start: slot.start,
        end: slot.end,
        restAfter: slot.patientRestMinutes,
      })),
    { start: startAt, end: endAt, restAfter },
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1]!;
    const curr = timeline[i]!;
    const need = Math.max(0, prev.restAfter);
    if (need > 0 && curr.start.getTime() - prev.end.getTime() < need * 60_000) return true;
  }
  return false;
}

function placementBlockReason(
  opened: boolean,
  sawStaffPool: boolean,
  blocks: { day_full: number; staff_busy: number; cabin_busy: number; rule: number },
): PlacementFailureReason {
  if (!opened) return "no_slot";
  if (!sawStaffPool) return "no_staff";
  const ranked = (Object.entries(blocks) as Array<[PlacementFailureReason, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? "no_slot";
}

/**
 * Place each order on the first legal slot inside the stay.
 * Occupancy, staff and rules are the arrays passed in — this function does not touch the database.
 * Later orders in the same batch see earlier placements.
 */
export function scanProcedureSlots(input: {
  orders: ScanOrder[];
  now: Date;
  slotMinutes: number;
  packageCap: number;
  horizonEndYmd: string;
  closedYmds: Set<string>;
  staffByTypeAndYmd: Map<string, ScanStaff[]>;
  rules: ScanRule[];
  rotationRules: ScanRotationRule[];
  compatibilityRules: ScanCompatRule[];
  patientSlots: ScanPatientSlot[];
  rotationContext: RotationContextSlot[];
  allocations: ScanAllocation[];
}): { planned: PlannedPlacement[]; failures: PlacementFailure[] } {
  const planned: PlannedPlacement[] = [];
  const failures: PlacementFailure[] = [];

  for (const order of input.orders) {
    if (order.resources.length === 0) {
      failures.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: "no_cabin",
      });
      continue;
    }

    let slotStart = nextOpenSlot(
      input.now,
      order.typeHours,
      order.dayEndHour,
      input.closedYmds,
      input.horizonEndYmd,
      input.slotMinutes,
    );
    if (slotStart && !order.afterLunchAllowed && bakuHourMinute(slotStart).hour >= order.typeHours.lunchEndHour) {
      slotStart = nextMorning(
        slotStart,
        order.typeHours,
        order.dayEndHour,
        input.closedYmds,
        input.horizonEndYmd,
      input.slotMinutes,
      );
    }
    if (slotStart && !order.beforeLunchAllowed && bakuHourMinute(slotStart).hour < order.typeHours.lunchEndHour) {
      slotStart = nextOpenSlot(
        bakuWallTime(slotStart, order.typeHours.lunchEndHour),
        order.typeHours,
        order.dayEndHour,
        input.closedYmds,
        input.horizonEndYmd,
      input.slotMinutes,
      );
    }

    let placed: PlannedPlacement | null = null;
    let sawStaffPool = false;
    const blocks = { day_full: 0, staff_busy: 0, cabin_busy: 0, rule: 0 };
    const opened = slotStart != null;
    for (let attempt = 0; attempt < 4000 && slotStart && !placed; attempt++) {
      slotStart = avoidLunchOverlap(slotStart, order.durationMin, order.typeHours);
      if (!order.afterLunchAllowed && bakuHourMinute(slotStart).hour >= order.typeHours.lunchEndHour) {
        slotStart = nextMorning(slotStart, order.typeHours, order.dayEndHour, input.closedYmds, input.horizonEndYmd, input.slotMinutes);
        continue;
      }
      if (!order.beforeLunchAllowed && bakuHourMinute(slotStart).hour < order.typeHours.lunchEndHour) {
        slotStart = nextOpenSlot(
          bakuWallTime(slotStart, order.typeHours.lunchEndHour),
          order.typeHours,
          order.dayEndHour,
          input.closedYmds,
          input.horizonEndYmd,
      input.slotMinutes,
        );
        continue;
      }

      const slotEnd = addMinutes(slotStart, order.durationMin);
      const slotEndHm = bakuHourMinute(slotEnd);
      if (slotEndHm.hour > order.dayEndHour || (slotEndHm.hour === order.dayEndHour && slotEndHm.minute > 0)) {
        slotStart = nextOpenSlot(
          addMinutes(slotStart, input.slotMinutes),
          order.typeHours,
          order.dayEndHour,
          input.closedYmds,
          input.horizonEndYmd,
      input.slotMinutes,
        );
        continue;
      }

      if (order.inPackage) {
        const codesOnDay = inPackageCodesOnBakuDay(
          input.patientSlots.map((slot) => ({
            code: slot.code,
            start: slot.start,
            inPackage: slot.inPackage,
          })),
          slotStart,
        );
        if (packageDayIsFullForNewCode(codesOnDay, order.procedureCode, input.packageCap)) {
          blocks.day_full += 1;
          slotStart = nextMorning(slotStart, order.typeHours, order.dayEndHour, input.closedYmds, input.horizonEndYmd, input.slotMinutes);
          continue;
        }
      }

      if (sameProcedureThatDay(input.patientSlots, order.procedureCode, slotStart)) {
        slotStart = nextMorning(slotStart, order.typeHours, order.dayEndHour, input.closedYmds, input.horizonEndYmd, input.slotMinutes);
        continue;
      }

      const rotation = evaluateRotationRules({
        candidateCode: order.procedureCode,
        bodyPart: order.bodyPart,
        day: slotStart,
        context: input.rotationContext,
        rules: input.rotationRules,
      });
      if (!rotation.ok) {
        blocks.rule += 1;
        slotStart = nextMorning(slotStart, order.typeHours, order.dayEndHour, input.closedYmds, input.horizonEndYmd, input.slotMinutes);
        continue;
      }

      const ymd = bakuDateKey(slotStart);
      const pool = input.staffByTypeAndYmd.get(`${order.procedureTypeId}|${ymd}`) ?? [];
      if (pool.length === 0) {
        slotStart = nextMorning(slotStart, order.typeHours, order.dayEndHour, input.closedYmds, input.horizonEndYmd, input.slotMinutes);
        continue;
      }
      sawStaffPool = true;
      const staff = pickStaff(
        pool,
        input.allocations,
        slotStart,
        slotEnd,
        order.id,
        order.staffMode,
      );
      if (!staff) {
        blocks.staff_busy += 1;
        slotStart = nextOpenSlot(
          addMinutes(slotStart, input.slotMinutes),
          order.typeHours,
          order.dayEndHour,
          input.closedYmds,
          input.horizonEndYmd,
      input.slotMinutes,
        );
        continue;
      }

      const ruleOk = input.rules.every((rule) => {
        if (rule.kind === "MUTUAL_EXCLUSION") {
          const hasBefore = input.patientSlots.some(
            (slot) => slot.code === rule.beforeCode && overlaps(slot.start, slot.end, slotStart!, slotEnd),
          );
          const hasAfter = input.patientSlots.some(
            (slot) => slot.code === rule.afterCode && overlaps(slot.start, slot.end, slotStart!, slotEnd),
          );
          if (hasBefore && hasAfter) return false;
        }
        if (rule.kind === "SEQUENCE_GAP" && rule.afterCode === order.procedureCode) {
          const prev = input.patientSlots.find((slot) => slot.code === rule.beforeCode);
          if (prev) {
            const gapMs = slotStart!.getTime() - prev.end.getTime();
            if (gapMs < (rule.minGapMinutes ?? 0) * 60_000) return false;
          }
        }
        return true;
      });
      const compat = validateProcedureCompatibilityRules({
        candidateCode: order.procedureCode,
        startAt: slotStart,
        endAt: slotEnd,
        existing: input.patientSlots.map((slot) => ({
          procedureCode: slot.code,
          startAt: slot.start,
          endAt: slot.end,
        })),
        rules: input.compatibilityRules,
      });
      if (!ruleOk || compat.length > 0 || restGap(input.patientSlots, slotStart, slotEnd, order.patientRestMinutes)) {
        blocks.rule += 1;
        slotStart = nextOpenSlot(
          addMinutes(slotStart, input.slotMinutes),
          order.typeHours,
          order.dayEndHour,
          input.closedYmds,
          input.horizonEndYmd,
      input.slotMinutes,
        );
        continue;
      }

      const resource = order.resources.find(
        (row) => resourceUsed(input.allocations, row.id, slotStart!, slotEnd, order.id) < row.capacity,
      );
      if (!resource) {
        blocks.cabin_busy += 1;
        slotStart = nextOpenSlot(
          addMinutes(slotStart, input.slotMinutes),
          order.typeHours,
          order.dayEndHour,
          input.closedYmds,
          input.horizonEndYmd,
      input.slotMinutes,
        );
        continue;
      }

      placed = {
        orderId: order.id,
        organizationId: order.organizationId,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        bodyPart: order.bodyPart,
        slotStart,
        slotEnd,
        resourceId: resource.id,
        physicalRole: order.physicalRole,
        staffId: staff.id,
        patientRestMinutes: order.patientRestMinutes,
        inPackage: order.inPackage,
        resourceGapMinutes: order.resourceGapMinutes,
      };
      input.patientSlots.push({
        code: order.procedureCode,
        bodyPart: order.bodyPart,
        start: slotStart,
        end: slotEnd,
        patientRestMinutes: order.patientRestMinutes,
        inPackage: order.inPackage,
        countsForRest: true,
      });
      input.rotationContext.push({
        procedureCode: order.procedureCode,
        bodyPart: order.bodyPart,
        startAt: slotStart,
        endAt: slotEnd,
      });
      input.allocations.push(
        {
          role: order.physicalRole,
          resourceId: resource.id,
          practitionerId: null,
          startsAt: slotStart,
          endsAt: slotEnd,
          procedureOrderId: order.id,
          resourceGapMinutes: order.resourceGapMinutes,
        },
        {
          role: "STAFF",
          resourceId: null,
          practitionerId: staff.id,
          startsAt: slotStart,
          endsAt: slotEnd,
          procedureOrderId: order.id,
          resourceGapMinutes: 0,
        },
      );
    }

    if (placed) planned.push(placed);
    else {
      failures.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: placementBlockReason(opened, sawStaffPool, blocks),
      });
    }
  }

  return { planned, failures };
}
