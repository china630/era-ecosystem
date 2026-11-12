import {
  inPackageCodesOnBakuDay,
  packageBlockIsFull,
  packageBlockDayUseIsFull,
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
  | "same_day"
  | "closed"
  | "lunch"
  | "cross_day"
  | "bath_rest"
  | "week_full"
  | "past_checkout"
  | "checkout_noon"
  | "rule"
  | "no_slot"
  | "anamnesis";

/** First pin day uses Saxla `now`; later pin days open at the type/clinic hour. */
export function pinSearchFrom(now: Date, pinYmd: string | undefined, typeDayStartHour: number): Date {
  if (!pinYmd) return now;
  const pinStart = bakuWallTime(bakuDayBounds(pinYmd).start, typeDayStartHour);
  if (bakuDateKey(now) === pinYmd) {
    return now.getTime() > pinStart.getTime() ? now : pinStart;
  }
  return pinStart;
}

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
  /** Package block whose daily cap this session spends. */
  quotaKey?: string;
  /** NO_SHOW blocks a second session the same day and does not create a rest gap. */
  countsForRest: boolean;
  /** Seated paid extra counts toward the block cap. */
  holdsGuestDay?: boolean;
};

type ScanRule = {
  kind: string;
  beforeCode: string | null;
  afterCode: string | null;
  minGapMinutes: number | null;
};

type ScanRotationRule = Parameters<typeof evaluateRotationRules>[0]["rules"][number];
type ScanCompatRule = Parameters<typeof validateProcedureCompatibilityRules>[0]["rules"][number];

export type DayHourWindow = { startHour: number; endHour: number };

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
  /**
   * Per-civil-day bookable hours from the working-time resolver.
   * When set, nextOpenSlot / evaluateCandidateSlot use this map instead of a single dayEndHour.
   */
  dayWindowByYmd?: Map<string, DayHourWindow>;
  physicalRole: "LOCATION" | "EQUIPMENT";
  resources: ScanResource[];
  staffMode: "HARD" | "SOFT";
  procedureTypeId: string;
  /** When set, only this Baku day is legal. Leaving the day is a miss. */
  pinYmd?: string;
  /** Package block for the daily distinct-SKU cap. */
  quotaKey?: string;
  /** Null = this block has no daily cap. Unset = caller still uses packageCap. */
  dailyCap?: number | null;
  /** DAILY_RATE: max units of this block per Asia/Baku day. */
  dailyUseCap?: number | null;
  /** Paid extra shares the package block cap without burning quota. */
  shareGuestDayCap?: boolean;
  /** When set, only this practitioner may take the session. */
  preferredStaffId?: string | null;
  preferredStaffName?: string | null;
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

export type PlacementBlockCounts = {
  day_full: number;
  same_day: number;
  no_staff: number;
  closed: number;
  cabin_busy: number;
  staff_busy: number;
  rule: number;
};

export type PlacementFailure = {
  orderId: string;
  procedureCode: string;
  procedureName: string;
  reason: PlacementFailureReason;
  ymd?: string;
  /** Named masseur who could not be seated. */
  staffName?: string;
  /** Baku clock the pin search started from, `YYYY-MM-DD HH:00`. */
  searchFrom?: string;
  counts?: PlacementBlockCounts;
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

function windowForDay(
  order: Pick<ScanOrder, "typeHours" | "dayEndHour" | "dayWindowByYmd">,
  ymd: string,
): DayHourWindow {
  const mapped = order.dayWindowByYmd?.get(ymd);
  if (mapped) return mapped;
  return { startHour: order.typeHours.dayStartHour, endHour: order.dayEndHour };
}

function nextOpenSlot(
  cursor: Date,
  order: Pick<ScanOrder, "typeHours" | "dayEndHour" | "dayWindowByYmd">,
  closed: Set<string>,
  horizonEndYmd: string,
  slotMinutes: number,
  noonCheckoutYmd?: string,
): Date | null {
  const hours = order.typeHours;
  let d = snapUpToSlot(cursor, slotMinutes);
  for (let i = 0; i < 400; i++) {
    const ymd = bakuDateKey(d);
    if (ymd >= horizonEndYmd) return null;
    d = skipLunch(d, hours);
    const win = windowForDay(order, ymd);
    const endHour =
      noonCheckoutYmd && ymd === noonCheckoutYmd ? Math.min(win.endHour, 12) : win.endHour;
    if (bakuHourMinute(d).hour >= endHour) {
      const nextYmd = addBakuDays(ymd, 1);
      const nextWin = windowForDay(order, nextYmd);
      d = bakuWallTime(bakuDayBounds(nextYmd).start, nextWin.startHour);
      continue;
    }
    if (bakuHourMinute(d).hour < win.startHour) {
      d = bakuWallTime(d, win.startHour);
    }
    if (closed.has(ymd)) {
      const nextYmd = addBakuDays(ymd, 1);
      const nextWin = windowForDay(order, nextYmd);
      d = bakuWallTime(bakuDayBounds(nextYmd).start, nextWin.startHour);
      continue;
    }
    return d;
  }
  return null;
}

function nextMorning(
  from: Date,
  order: Pick<ScanOrder, "typeHours" | "dayEndHour" | "dayWindowByYmd">,
  closed: Set<string>,
  horizonEndYmd: string,
  slotMinutes: number,
  noonCheckoutYmd?: string,
): Date | null {
  const nextYmd = addBakuDays(bakuDateKey(from), 1);
  const nextWin = windowForDay(order, nextYmd);
  const d = bakuWallTime(bakuDayBounds(nextYmd).start, nextWin.startHour);
  return nextOpenSlot(d, order, closed, horizonEndYmd, slotMinutes, noonCheckoutYmd);
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

/** Occupancy split by cabin and person. A seat added during the scan joins the same maps. */
export function indexScanAllocations(allocs: ScanAllocation[]): {
  byResource: Map<string, ScanAllocation[]>;
  byStaff: Map<string, ScanAllocation[]>;
  add: (row: ScanAllocation) => void;
} {
  const byResource = new Map<string, ScanAllocation[]>();
  const byStaff = new Map<string, ScanAllocation[]>();
  const add = (row: ScanAllocation) => {
    if (row.resourceId && (row.role === "LOCATION" || row.role === "EQUIPMENT")) {
      const list = byResource.get(row.resourceId) ?? [];
      list.push(row);
      byResource.set(row.resourceId, list);
    }
    if (row.practitionerId && row.role === "STAFF") {
      const list = byStaff.get(row.practitionerId) ?? [];
      list.push(row);
      byStaff.set(row.practitionerId, list);
    }
  };
  for (const row of allocs) add(row);
  return { byResource, byStaff, add };
}

/**
 * Next grid time at which at least one cabin of this procedure is free.
 * The cabin stays busy until the occupying session ends plus that session's own gap.
 */
export function nextCabinGridTime(
  order: Pick<ScanOrder, "id" | "resources" | "durationMin" | "physicalRole">,
  slotStart: Date,
  allocations: ScanAllocation[],
  slotMinutes: number,
): Date | null {
  if (order.resources.length === 0) return null;
  const slotEnd = addMinutes(slotStart, order.durationMin);
  let earliest: Date | null = null;
  for (const resource of order.resources) {
    let busyUntil = slotStart;
    let blocked = false;
    for (const row of allocations) {
      if (row.role !== "LOCATION" && row.role !== "EQUIPMENT") continue;
      if (row.resourceId !== resource.id) continue;
      if (row.procedureOrderId === order.id) continue;
      if (
        !allocationOccupiesCandidate(
          row.startsAt,
          row.endsAt,
          row.resourceGapMinutes,
          slotStart,
          slotEnd,
        )
      ) {
        continue;
      }
      blocked = true;
      const occupiedEnd = new Date(
        row.endsAt.getTime() + Math.max(0, row.resourceGapMinutes) * 60_000,
      );
      if (occupiedEnd > busyUntil) busyUntil = occupiedEnd;
    }
    const opened = blocked ? snapUpToSlot(busyUntil, slotMinutes) : slotStart;
    const candidate =
      opened.getTime() <= slotStart.getTime() ? addMinutes(slotStart, slotMinutes) : opened;
    if (!earliest || candidate.getTime() < earliest.getTime()) earliest = candidate;
  }
  return earliest;
}

function pickStaff(
  people: ScanStaff[],
  allocs: ScanAllocation[],
  startsAt: Date,
  endsAt: Date,
  orderId: string,
  mode: "HARD" | "SOFT",
  byStaff?: Map<string, ScanAllocation[]>,
): ScanStaff | null {
  const rowsFor = (personId: string) => byStaff?.get(personId) ?? allocs;
  if (people.length === 0) return null;
  if (mode === "SOFT") {
    let best = people[0]!;
    let bestBusy = Number.POSITIVE_INFINITY;
    for (const person of people) {
      const busy = staffBusy(rowsFor(person.id), person.id, startsAt, endsAt, orderId);
      if (busy < bestBusy) {
        best = person;
        bestBusy = busy;
        if (busy === 0) break;
      }
    }
    return best;
  }
  for (const person of people) {
    if (staffBusy(rowsFor(person.id), person.id, startsAt, endsAt, orderId) === 0) return person;
  }
  return null;
}

function sameProcedureThatDay(slots: ScanPatientSlot[], code: string, day: Date): boolean {
  const key = bakuDateKey(day);
  return slots.some((slot) => slot.code === code && bakuDateKey(slot.start) === key);
}

/**
 * True when the candidate conflicts with an existing wall-clock rest slot.
 * Only the candidate is validated — pre-existing overlaps among other rows must
 * not poison every later seat that Baku day (OPEN day-bucket stamps used to).
 */
export function restGap(
  slots: ScanPatientSlot[],
  startAt: Date,
  endAt: Date,
  restAfter: number,
): boolean {
  const key = bakuDateKey(startAt);
  const existing = slots.filter(
    (slot) => slot.countsForRest && bakuDateKey(slot.start) === key,
  );
  for (const slot of existing) {
    if (startAt.getTime() < slot.end.getTime() && slot.start.getTime() < endAt.getTime()) {
      return true;
    }
    if (startAt.getTime() >= slot.end.getTime()) {
      const need = Math.max(0, slot.patientRestMinutes);
      if (need > 0 && startAt.getTime() - slot.end.getTime() < need * 60_000) return true;
    } else if (endAt.getTime() <= slot.start.getTime()) {
      const need = Math.max(0, restAfter);
      if (need > 0 && slot.start.getTime() - endAt.getTime() < need * 60_000) return true;
    }
  }
  return false;
}

export type CandidateSlotInput = {
  order: ScanOrder;
  slotStart: Date;
  slotEnd: Date;
  packageCap: number;
  closedYmds: Set<string>;
  noonCheckoutYmd?: string;
  staffByTypeAndYmd: Map<string, ScanStaff[]>;
  rules: ScanRule[];
  rotationRules: ScanRotationRule[];
  compatibilityRules: ScanCompatRule[];
  patientSlots: ScanPatientSlot[];
  rotationContext: RotationContextSlot[];
  allocations: ScanAllocation[];
  /** Cabin rows only. When set, cabin checks skip the full occupancy list. */
  allocationsByResource?: Map<string, ScanAllocation[]>;
  /** Staff rows only. When set, nurse checks skip the full occupancy list. */
  allocationsByStaff?: Map<string, ScanAllocation[]>;
  /** Manual move: this cabin only. Auto search leaves it unset. */
  requiredResourceId?: string | null;
};

export type CandidateSlotOk = {
  ok: true;
  resource: ScanResource;
  staff: ScanStaff;
};

export type CandidateSlotFail = {
  ok: false;
  reason: PlacementFailureReason;
  sawStaffPool: boolean;
};

/**
 * One legality check for a concrete minute + cabin.
 * Auto search advances after a miss. Manual PATCH must refuse — never snap.
 */
export function evaluateCandidateSlot(
  input: CandidateSlotInput,
): CandidateSlotOk | CandidateSlotFail {
  const { order, slotStart, slotEnd } = input;
  const ymd = bakuDateKey(slotStart);
  const fail = (reason: PlacementFailureReason, sawStaffPool = false): CandidateSlotFail => ({
    ok: false,
    reason,
    sawStaffPool,
  });

  if (input.closedYmds.has(ymd)) return fail("closed");
  if (order.pinYmd && ymd !== order.pinYmd) return fail("no_slot");

  const startHm = bakuHourMinute(slotStart);
  const endHm = bakuHourMinute(slotEnd);
  const win = windowForDay(order, ymd);
  if (startHm.hour < win.startHour) return fail("no_slot");
  const endLimit =
    input.noonCheckoutYmd && ymd === input.noonCheckoutYmd
      ? Math.min(win.endHour, 12)
      : win.endHour;
  if (endHm.hour > endLimit || (endHm.hour === endLimit && endHm.minute > 0)) {
    return fail("no_slot");
  }
  if (startHm.hour >= order.typeHours.lunchStartHour && startHm.hour < order.typeHours.lunchEndHour) {
    return fail("lunch");
  }
  const lunchStart = bakuWallTime(slotStart, order.typeHours.lunchStartHour);
  const lunchEnd = bakuWallTime(slotStart, order.typeHours.lunchEndHour);
  if (slotStart.getTime() < lunchEnd.getTime() && slotEnd.getTime() > lunchStart.getTime()) {
    return fail("lunch");
  }
  if (!order.afterLunchAllowed && startHm.hour >= order.typeHours.lunchEndHour) return fail("lunch");
  if (!order.beforeLunchAllowed && startHm.hour < order.typeHours.lunchEndHour) return fail("lunch");

  const shareCap = order.inPackage || order.shareGuestDayCap === true;
  const daySlots = input.patientSlots.map((slot) => ({
    code: slot.code,
    start: slot.start,
    inPackage: slot.inPackage || slot.holdsGuestDay === true,
    quotaKey: slot.quotaKey || slot.code,
  }));
  if (shareCap && order.quotaKey && order.dailyUseCap != null) {
    if (
      packageBlockDayUseIsFull({
        slots: daySlots,
        day: slotStart,
        quotaKey: order.quotaKey,
        cap: order.dailyUseCap,
      })
    ) {
      return fail("day_full");
    }
  }
  if (shareCap && order.dailyCap !== null) {
    if (order.quotaKey && order.dailyCap != null) {
      if (
        packageBlockIsFull({
          slots: daySlots,
          day: slotStart,
          candidateCode: order.procedureCode,
          quotaKey: order.quotaKey,
          cap: order.dailyCap,
        })
      ) {
        return fail("day_full");
      }
    } else if (order.inPackage && order.dailyCap === undefined) {
      const codesOnDay = inPackageCodesOnBakuDay(
        input.patientSlots.map((slot) => ({
          code: slot.code,
          start: slot.start,
          inPackage: slot.inPackage,
        })),
        slotStart,
      );
      if (packageDayIsFullForNewCode(codesOnDay, order.procedureCode, input.packageCap)) {
        return fail("day_full");
      }
    }
  }

  if (sameProcedureThatDay(input.patientSlots, order.procedureCode, slotStart)) {
    return fail("same_day");
  }

  const rotation = evaluateRotationRules({
    candidateCode: order.procedureCode,
    bodyPart: order.bodyPart,
    day: slotStart,
    context: input.rotationContext,
    rules: input.rotationRules,
  });
  if (!rotation.ok) return fail("rule");

  let pool = input.staffByTypeAndYmd.get(`${order.procedureTypeId}|${ymd}`) ?? [];
  if (order.preferredStaffId) {
    pool = pool.filter((person) => person.id === order.preferredStaffId);
    if (pool.length === 0) return fail("no_staff");
  }
  if (pool.length === 0) return fail("no_staff");
  const staff = pickStaff(
    pool,
    input.allocations,
    slotStart,
    slotEnd,
    order.id,
    order.staffMode,
    input.allocationsByStaff,
  );
  if (!staff) return fail("staff_busy", true);

  // OPEN day-bucket stamps stay in patientSlots for same-day / package caps, but
  // must not enter wall-clock overlap, sequence gap, or compatibility (ADR CLI-62).
  const wallClockSlots = input.patientSlots.filter((slot) => slot.countsForRest);
  const ruleOk = input.rules.every((rule) => {
    if (rule.kind === "MUTUAL_EXCLUSION") {
      const hasBefore = wallClockSlots.some(
        (slot) => slot.code === rule.beforeCode && overlaps(slot.start, slot.end, slotStart, slotEnd),
      );
      const hasAfter = wallClockSlots.some(
        (slot) => slot.code === rule.afterCode && overlaps(slot.start, slot.end, slotStart, slotEnd),
      );
      if (hasBefore && hasAfter) return false;
    }
    if (rule.kind === "SEQUENCE_GAP" && rule.afterCode === order.procedureCode) {
      const prev = wallClockSlots.find((slot) => slot.code === rule.beforeCode);
      if (prev) {
        const gapMs = slotStart.getTime() - prev.end.getTime();
        if (gapMs < (rule.minGapMinutes ?? 0) * 60_000) return false;
      }
    }
    return true;
  });
  const compat = validateProcedureCompatibilityRules({
    candidateCode: order.procedureCode,
    startAt: slotStart,
    endAt: slotEnd,
    existing: wallClockSlots.map((slot) => ({
      procedureCode: slot.code,
      startAt: slot.start,
      endAt: slot.end,
    })),
    rules: input.compatibilityRules,
  });
  if (!ruleOk || compat.length > 0 || restGap(input.patientSlots, slotStart, slotEnd, order.patientRestMinutes)) {
    return fail("rule", true);
  }

  const candidates = input.requiredResourceId
    ? order.resources.filter((row) => row.id === input.requiredResourceId)
    : order.resources;
  if (order.resources.length === 0) return fail("no_cabin", true);
  if (input.requiredResourceId && candidates.length === 0) return fail("no_cabin", true);
  const resource = candidates.find(
    (row) =>
      resourceUsed(
        input.allocationsByResource?.get(row.id) ?? input.allocations,
        row.id,
        slotStart,
        slotEnd,
        order.id,
      ) < row.capacity,
  );
  if (!resource) return fail("cabin_busy", true);

  return { ok: true, resource, staff };
}

/** Day-full is decided before the staff pool is read — do not report that as no_staff. */
export function placementBlockReason(
  opened: boolean,
  sawStaffPool: boolean,
  blocks: PlacementBlockCounts,
): PlacementFailureReason {
  if (!opened) return "no_slot";
  if (blocks.day_full > 0) return "day_full";
  if (blocks.same_day > 0) return "same_day";
  if (blocks.closed > 0) return "closed";
  if (!sawStaffPool) return "no_staff";
  const ranked = (Object.entries(blocks) as Array<[PlacementFailureReason, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? "no_slot";
}

/**
 * Sanatorium seating: a procedure with fewer free cabin windows on the horizon
 * is seated as a whole series before a looser one. Sessions of one code keep
 * their order. A pinned day stays in its place. Cabin occupancy already loaded
 * for the scan is the only input — this does not walk staff or the patient.
 */
export function orderScarceSeriesFirst(
  orders: ScanOrder[],
  input: {
    now: Date;
    slotMinutes: number;
    horizonEndYmd: string;
    closedYmds: Set<string>;
    noonCheckoutYmd?: string;
    allocations: ScanAllocation[];
  },
): ScanOrder[] {
  if (orders.length < 2) return orders;
  const loose = orders.filter((order) => !order.pinYmd);
  if (loose.length < 2) return orders;

  const byResource = new Map<string, ScanAllocation[]>();
  for (const row of input.allocations) {
    if ((row.role !== "LOCATION" && row.role !== "EQUIPMENT") || !row.resourceId) continue;
    const list = byResource.get(row.resourceId) ?? [];
    list.push(row);
    byResource.set(row.resourceId, list);
  }

  const windowsByCode = new Map<string, { windows: number; first: number }>();
  loose.forEach((order, index) => {
    if (windowsByCode.has(order.procedureCode)) return;
    windowsByCode.set(order.procedureCode, {
      windows: countFreeCabinWindows(order, input, byResource),
      first: index,
    });
  });

  const sorted = [...loose].sort((a, b) => {
    const left = windowsByCode.get(a.procedureCode)!;
    const right = windowsByCode.get(b.procedureCode)!;
    if (left.windows !== right.windows) return left.windows - right.windows;
    return left.first - right.first;
  });

  const result = orders.slice();
  let next = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i]!.pinYmd) continue;
    result[i] = sorted[next++]!;
  }
  return result;
}

function countFreeCabinWindows(
  order: ScanOrder,
  input: {
    now: Date;
    slotMinutes: number;
    horizonEndYmd: string;
    closedYmds: Set<string>;
    noonCheckoutYmd?: string;
  },
  byResource: Map<string, ScanAllocation[]>,
): number {
  if (order.resources.length === 0) return Number.MAX_SAFE_INTEGER;
  const step = Math.max(1, input.slotMinutes);
  let windows = 0;
  let ymd = bakuDateKey(input.now);
  for (let day = 0; day < 40 && ymd < input.horizonEndYmd; day++) {
    const cursorDay = ymd;
    ymd = addBakuDays(ymd, 1);
    if (input.closedYmds.has(cursorDay)) continue;
    const win = windowForDay(order, cursorDay);
    const endHour =
      input.noonCheckoutYmd && cursorDay === input.noonCheckoutYmd
        ? Math.min(win.endHour, 12)
        : win.endHour;
    if (endHour <= win.startHour) continue;
    let slot = bakuWallTime(bakuDayBounds(cursorDay).start, win.startHour);
    if (cursorDay === bakuDateKey(input.now) && input.now.getTime() > slot.getTime()) {
      slot = snapUpToSlot(input.now, step);
    }
    for (let guard = 0; guard < 300; guard++) {
      if (bakuDateKey(slot) !== cursorDay) break;
      if (bakuHourMinute(slot).hour >= endHour) break;
      const hour = bakuHourMinute(slot).hour;
      const lunchStart = order.typeHours.lunchStartHour;
      const lunchEnd = order.typeHours.lunchEndHour;
      if (hour >= lunchStart && hour < lunchEnd) {
        slot = bakuWallTime(slot, lunchEnd);
        continue;
      }
      if (!order.afterLunchAllowed && hour >= lunchEnd) break;
      if (!order.beforeLunchAllowed && hour < lunchEnd) {
        slot = bakuWallTime(slot, lunchEnd);
        continue;
      }
      const slotEnd = addMinutes(slot, order.durationMin);
      if (bakuDateKey(slotEnd) !== cursorDay || bakuHourMinute(slotEnd).hour > endHour) break;
      const overlapsLunch =
        slot.getTime() < bakuWallTime(slot, lunchEnd).getTime() &&
        slotEnd.getTime() > bakuWallTime(slot, lunchStart).getTime();
      if (overlapsLunch) {
        slot = bakuWallTime(slot, lunchEnd);
        continue;
      }
      const open = order.resources.some(
        (resource) =>
          resourceUsed(byResource.get(resource.id) ?? [], resource.id, slot, slotEnd, order.id) <
          resource.capacity,
      );
      if (open) windows += 1;
      slot = addMinutes(slot, step);
    }
  }
  return windows;
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
  noonCheckoutYmd?: string;
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
  const occupancy = indexScanAllocations(input.allocations);

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

    const pinStartHour = order.pinYmd
      ? windowForDay(order, order.pinYmd).startHour
      : order.typeHours.dayStartHour;
    const searchFrom = pinSearchFrom(input.now, order.pinYmd, pinStartHour);
    let slotStart = nextOpenSlot(
      searchFrom,
      order,
      input.closedYmds,
      input.horizonEndYmd,
      input.slotMinutes,
      input.noonCheckoutYmd,
    );
    if (slotStart && !order.afterLunchAllowed && bakuHourMinute(slotStart).hour >= order.typeHours.lunchEndHour) {
      slotStart = nextMorning(
        slotStart,
        order,
        input.closedYmds,
        input.horizonEndYmd,
        input.slotMinutes,
        input.noonCheckoutYmd,
      );
    }
    if (slotStart && !order.beforeLunchAllowed && bakuHourMinute(slotStart).hour < order.typeHours.lunchEndHour) {
      slotStart = nextOpenSlot(
        bakuWallTime(slotStart, order.typeHours.lunchEndHour),
        order,
        input.closedYmds,
        input.horizonEndYmd,
        input.slotMinutes,
        input.noonCheckoutYmd,
      );
    }

    let placed: PlannedPlacement | null = null;
    let sawStaffPool = false;
    let lastYmd = "";
    const blocks: PlacementBlockCounts = {
      day_full: 0,
      same_day: 0,
      no_staff: 0,
      closed: 0,
      cabin_busy: 0,
      staff_busy: 0,
      rule: 0,
    };
    const opened = slotStart != null;
    for (let attempt = 0; attempt < 4000 && slotStart && !placed; attempt++) {
      if (order.pinYmd && bakuDateKey(slotStart) !== order.pinYmd) {
        slotStart = null;
        break;
      }
      slotStart = avoidLunchOverlap(slotStart, order.durationMin, order.typeHours);
      if (!order.afterLunchAllowed && bakuHourMinute(slotStart).hour >= order.typeHours.lunchEndHour) {
        slotStart = nextMorning(slotStart, order, input.closedYmds, input.horizonEndYmd, input.slotMinutes, input.noonCheckoutYmd);
        continue;
      }
      if (!order.beforeLunchAllowed && bakuHourMinute(slotStart).hour < order.typeHours.lunchEndHour) {
        slotStart = nextOpenSlot(
          bakuWallTime(slotStart, order.typeHours.lunchEndHour),
          order,
          input.closedYmds,
          input.horizonEndYmd,
          input.slotMinutes,
          input.noonCheckoutYmd,
        );
        continue;
      }

      const slotEnd = addMinutes(slotStart, order.durationMin);
      lastYmd = bakuDateKey(slotStart);
      const verdict = evaluateCandidateSlot({
        order,
        slotStart,
        slotEnd,
        packageCap: input.packageCap,
        closedYmds: input.closedYmds,
        noonCheckoutYmd: input.noonCheckoutYmd,
        staffByTypeAndYmd: input.staffByTypeAndYmd,
        rules: input.rules,
        rotationRules: input.rotationRules,
        compatibilityRules: input.compatibilityRules,
        patientSlots: input.patientSlots,
        rotationContext: input.rotationContext,
        allocations: input.allocations,
        allocationsByResource: occupancy.byResource,
        allocationsByStaff: occupancy.byStaff,
      });
      if (!verdict.ok) {
        if (verdict.sawStaffPool) sawStaffPool = true;
        if (verdict.reason === "day_full") blocks.day_full += 1;
        if (verdict.reason === "same_day") blocks.same_day += 1;
        if (verdict.reason === "no_staff") blocks.no_staff += 1;
        if (verdict.reason === "closed") blocks.closed += 1;
        if (verdict.reason === "staff_busy") blocks.staff_busy += 1;
        if (verdict.reason === "cabin_busy") blocks.cabin_busy += 1;
        if (verdict.reason === "rule" || verdict.reason === "lunch") blocks.rule += 1;
        // A pinned day stays on that civil day. Jumping to the next morning
        // makes the pin check abort the afternoon after the first miss.
        const jumpMorning =
          !order.pinYmd &&
          (verdict.reason === "day_full" ||
            verdict.reason === "same_day" ||
            verdict.reason === "no_staff" ||
            verdict.reason === "closed");
        if (!order.pinYmd && verdict.reason === "cabin_busy") {
          const cabinAt = nextCabinGridTime(
            order,
            slotStart,
            input.allocations,
            input.slotMinutes,
          );
          slotStart = cabinAt
            ? nextOpenSlot(
                cabinAt,
                order,
                input.closedYmds,
                input.horizonEndYmd,
                input.slotMinutes,
                input.noonCheckoutYmd,
              )
            : null;
          continue;
        }
        slotStart = jumpMorning
          ? nextMorning(slotStart, order, input.closedYmds, input.horizonEndYmd, input.slotMinutes, input.noonCheckoutYmd)
          : nextOpenSlot(
              addMinutes(slotStart, input.slotMinutes),
              order,
              input.closedYmds,
              input.horizonEndYmd,
              input.slotMinutes,
              input.noonCheckoutYmd,
            );
        continue;
      }
      sawStaffPool = true;

      placed = {
        orderId: order.id,
        organizationId: order.organizationId,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        bodyPart: order.bodyPart,
        slotStart,
        slotEnd,
        resourceId: verdict.resource.id,
        physicalRole: order.physicalRole,
        staffId: verdict.staff.id,
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
        quotaKey: order.quotaKey,
        countsForRest: true,
        holdsGuestDay: order.shareGuestDayCap === true,
      });
      input.rotationContext.push({
        procedureCode: order.procedureCode,
        bodyPart: order.bodyPart,
        startAt: slotStart,
        endAt: slotEnd,
      });
      const cabinRow: ScanAllocation = {
        role: order.physicalRole,
        resourceId: verdict.resource.id,
        practitionerId: null,
        startsAt: slotStart,
        endsAt: slotEnd,
        procedureOrderId: order.id,
        resourceGapMinutes: order.resourceGapMinutes,
      };
      const staffRow: ScanAllocation = {
        role: "STAFF",
        resourceId: null,
        practitionerId: verdict.staff.id,
        startsAt: slotStart,
        endsAt: slotEnd,
        procedureOrderId: order.id,
        resourceGapMinutes: 0,
      };
      input.allocations.push(cabinRow, staffRow);
      occupancy.add(cabinRow);
      occupancy.add(staffRow);
    }

    if (placed) planned.push(placed);
    else {
      const searchHm = bakuHourMinute(searchFrom);
      failures.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: placementBlockReason(opened, sawStaffPool, blocks),
        ymd: lastYmd || order.pinYmd || undefined,
        staffName: order.preferredStaffName?.trim() || undefined,
        searchFrom: `${bakuDateKey(searchFrom)} ${String(searchHm.hour).padStart(2, "0")}:${String(searchHm.minute).padStart(2, "0")}`,
        counts: { ...blocks },
      });
    }
  }

  return { planned, failures };
}
