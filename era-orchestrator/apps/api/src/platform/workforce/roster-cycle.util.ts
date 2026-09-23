/**
 * Pure Asia/Baku labor-roster cycle resolver (Evrostar wave 2).
 * Pattern mirrors clinic CLI-36 CYCLE offset math; lives in CP, not clinic.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export { bakuDateKey as bakuYmd } from "@era/satellite-kit/time";

export function utcFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 0-based slot index on the repeating tape for targetYmd relative to cycleAnchor. */
export function cycleSlotIndex(
  cycleAnchorYmd: string,
  targetYmd: string,
  cycleLength: number,
): number {
  if (cycleLength < 1) {
    throw new Error("cycleLength must be >= 1");
  }
  const anchorUtc = utcFromYmd(cycleAnchorYmd).getTime();
  const targetUtc = utcFromYmd(targetYmd).getTime();
  const diffDays = Math.round((targetUtc - anchorUtc) / MS_PER_DAY);
  return ((diffDays % cycleLength) + cycleLength) % cycleLength;
}

export type RosterTapeSlot =
  | { kind: "OFF" }
  | { kind: "SHIFT"; shiftTypeId: string; defaultHours: number };

export type ResolvedRosterDay = {
  type: "WORK" | "OFF";
  hours: number;
  shiftTypeId: string | null;
  placeId: string | null;
  assignmentId: string | null;
  fromOverride: boolean;
};

export function resolveCycleSlot(
  slots: RosterTapeSlot[],
  cycleAnchorYmd: string,
  targetYmd: string,
): RosterTapeSlot {
  if (slots.length < 1) return { kind: "OFF" };
  const idx = cycleSlotIndex(cycleAnchorYmd, targetYmd, slots.length);
  return slots[idx] ?? { kind: "OFF" };
}

export type DayOverrideInput = {
  kind: "DAY_OFF" | "EXTRA" | "SWAP";
  placeId?: string | null;
  shiftTypeId?: string | null;
  defaultHours?: number | null;
};

/**
 * Override wins over cycle. Caller must skip lockedFromAbsence cells entirely
 * (absence lock beats override).
 */
export function applyDayOverride(
  base: ResolvedRosterDay,
  override: DayOverrideInput | null | undefined,
): ResolvedRosterDay {
  if (!override) return base;
  if (override.kind === "DAY_OFF") {
    return {
      type: "OFF",
      hours: 0,
      shiftTypeId: null,
      placeId: override.placeId ?? base.placeId,
      assignmentId: base.assignmentId,
      fromOverride: true,
    };
  }
  // EXTRA / SWAP → WORK with optional place/type swap
  const hours =
    override.defaultHours != null && Number.isFinite(Number(override.defaultHours))
      ? Number(override.defaultHours)
      : base.type === "WORK"
        ? base.hours
        : 8;
  return {
    type: "WORK",
    hours,
    shiftTypeId: override.shiftTypeId ?? base.shiftTypeId,
    placeId: override.placeId ?? base.placeId,
    assignmentId: base.assignmentId,
    fromOverride: true,
  };
}

export function resolvedFromCycleSlot(
  slot: RosterTapeSlot,
  placeId: string,
  assignmentId: string,
): ResolvedRosterDay {
  if (slot.kind === "OFF") {
    return {
      type: "OFF",
      hours: 0,
      shiftTypeId: null,
      placeId,
      assignmentId,
      fromOverride: false,
    };
  }
  return {
    type: "WORK",
    hours: Number(slot.defaultHours) || 8,
    shiftTypeId: slot.shiftTypeId,
    placeId,
    assignmentId,
    fromOverride: false,
  };
}

/** Seed tape helpers (codes resolved to ids by ensureDefaults). */
export const SEED_SHIFT_TYPES = [
  {
    code: "E",
    name: "Day 08–16",
    startMinute: 8 * 60,
    endMinute: 16 * 60,
    breakMinutes: 60,
    isNight: false,
    defaultHours: 7,
  },
  {
    code: "N",
    name: "Night 20–08",
    startMinute: 20 * 60,
    endMinute: 8 * 60,
    breakMinutes: 60,
    isNight: true,
    defaultHours: 11,
  },
  {
    code: "OFFICE",
    name: "Office 09–18",
    startMinute: 9 * 60,
    endMinute: 18 * 60,
    breakMinutes: 60,
    isNight: false,
    defaultHours: 8,
  },
  {
    code: "H24",
    name: "24h",
    startMinute: 0,
    endMinute: 24 * 60,
    breakMinutes: 0,
    isNight: true,
    defaultHours: 24,
  },
] as const;

export type SeedCycleDef = {
  code: string;
  name: string;
  /** Shift type codes or "OFF" for each slot. */
  tape: readonly string[];
};

export const SEED_CYCLES: readonly SeedCycleDef[] = [
  {
    code: "FIVE_TWO",
    name: "5/2 office",
    tape: ["OFFICE", "OFFICE", "OFFICE", "OFFICE", "OFFICE", "OFF", "OFF"],
  },
  {
    code: "TWO_TWO",
    name: "2/2 day",
    tape: ["E", "E", "OFF", "OFF"],
  },
  {
    code: "TWENTY_FOUR_FORTY_EIGHT",
    name: "24/48",
    tape: ["H24", "OFF", "OFF"],
  },
];
