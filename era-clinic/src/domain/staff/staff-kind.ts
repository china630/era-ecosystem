import type { PractitionerStaffKind } from "@prisma/client";

export class StaffDutyError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StaffDutyError";
    this.status = status;
  }
}

const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isYearMonth(value: string): boolean {
  return YEAR_MONTH_RE.test(value);
}

export function yearMonthOfYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

export function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive Asia/Baku month as YYYY-MM-DD bounds. */
export function yearMonthYmdBounds(yearMonth: string): { fromYmd: string; toYmd: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    fromYmd: `${yearMonth}-01`,
    toYmd: `${yearMonth}-${String(last).padStart(2, "0")}`,
  };
}

export function inferStaffKind(input: {
  specialty?: string | null;
  code?: string | null;
  role?: string | null;
}): PractitionerStaffKind {
  const role = (input.role ?? "").toUpperCase();
  if (role === "NURSE") return "NURSE";
  // FLOOR is an attendance controller; for storage it uses the existing NURSE staffKind
  // so it doesn't appear in doctor matrix / scheduling where staffKind=DOCTOR is required.
  if (role === "FLOOR") return "NURSE";
  if (role === "LAB_TECH" || role === "LAB") return "LAB";
  if (role === "DOCTOR") return "DOCTOR";
  if (role === "BATH" || role === "BATH_ATTENDANT") return "BATH";
  if (role === "MASSAGE" || role === "MASSEUR") return "MASSAGE";

  const blob = `${input.specialty ?? ""} ${input.code ?? ""}`.toLowerCase();
  if (
    blob.includes("nurse") ||
    blob.includes("медсестр") ||
    blob.includes("bacı") ||
    blob.includes("baci") ||
    blob.startsWith("nr-") ||
    blob.includes("nurse-")
  ) {
    return "NURSE";
  }
  if (blob.includes("lab") || blob.includes("лаборант") || blob.startsWith("lab")) {
    return "LAB";
  }
  if (blob.includes("банщик") || blob.includes("bansh") || blob.includes("vanna")) return "BATH";
  if (blob.includes("массаж") || blob.includes("masaj") || blob.includes("massage")) return "MASSAGE";
  return "DOCTOR";
}

/** People who can be posted on the procedure duty chart. Lab stays on its own roster. */
export function rosterStaffKinds(staffKind: PractitionerStaffKind): PractitionerStaffKind[] {
  if (staffKind === "LAB") return ["LAB"];
  return ["DOCTOR", "NURSE", "BATH", "MASSAGE"];
}

export function staffKindFromSatelliteRole(role: string | undefined | null): PractitionerStaffKind {
  return inferStaffKind({ role: role ?? undefined });
}

export type AbsenceWindow = { startsOn: Date; endsOn: Date };

/** Date-only compare using UTC calendar day of stored timestamps. */
export function ymdFromDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isAbsentOnYmd(windows: AbsenceWindow[], ymd: string): boolean {
  return windows.some((w) => {
    const from = ymdFromDateOnly(w.startsOn);
    const to = ymdFromDateOnly(w.endsOn);
    return ymd >= from && ymd <= to;
  });
}

export type DutyCandidate = { id: string; fullName: string; code: string };

/**
 * Duty resolution for STAFF slots (CLI-38b):
 * 1. Explicit day override → that practitioner
 * 2. APPROVED + posted present → posted only
 * 3. APPROVED + (absent | unassigned) + no override → empty (no silent pool)
 * 4. Draft / missing roster → skilled pool unchanged
 */
export function resolveDutyCandidates(input: {
  rosterStatus: "DRAFT" | "APPROVED" | null;
  postedPractitionerId: string | null;
  posted?: DutyCandidate | null;
  /** Several people posted on one procedure. Absent ids are dropped. */
  postedStaff?: DutyCandidate[];
  /** Ids inside postedStaff who are absent that day. */
  absentIds?: string[];
  postedAbsent: boolean;
  skilled: DutyCandidate[];
  /** Head-doctor day substitute; wins over the posted list when set. */
  dayOverridePractitionerId?: string | null;
  dayOverride?: DutyCandidate | null;
}): DutyCandidate[] {
  const overrideId = input.dayOverridePractitionerId ?? null;
  if (overrideId) {
    const override =
      input.dayOverride ??
      input.skilled.find((p) => p.id === overrideId) ??
      input.postedStaff?.find((p) => p.id === overrideId) ??
      null;
    if (override) return [override];
    return [{ id: overrideId, fullName: "", code: "" }];
  }

  if (input.rosterStatus !== "APPROVED") {
    return input.skilled;
  }

  const postedStaff =
    input.postedStaff ??
    (input.posted
      ? [input.posted]
      : input.postedPractitionerId
        ? [{ id: input.postedPractitionerId, fullName: "", code: "" }]
        : []);
  if (postedStaff.length === 0 || (input.postedAbsent && !input.postedStaff)) {
    return [];
  }
  const absent = new Set(input.absentIds ?? []);
  if (input.postedAbsent && input.postedPractitionerId && !input.postedStaff) {
    absent.add(input.postedPractitionerId);
  }
  return postedStaff.filter((person) => !absent.has(person.id));
}

export type RosterReassignSlot = {
  allocationId: string;
  procedureTypeId: string;
  startsAt: Date;
  endsAt: Date;
  /** HARD: one nurse cannot cover two overlapping slots. */
  staffMode: "HARD" | "SOFT";
  /** Asia/Baku civil day of the slot. */
  ymd: string;
};

export type RosterReassignOccupation = {
  practitionerId: string;
  startsAt: Date;
  endsAt: Date;
  staffMode: "HARD" | "SOFT";
};

/**
 * On roster approve: future not-started staff slots take a free person from
 * the monthly posts for that procedure (or that day's override). Cabin time
 * stays. HARD skips a person who already overlaps and tries the next post.
 * Past and already-started slots are not in `slots`; pass them as
 * `occupations` so they still block a HARD person.
 */
export function planRosterStaffReassignment(input: {
  slots: RosterReassignSlot[];
  occupations: RosterReassignOccupation[];
  posts: Array<{ procedureTypeId: string; practitionerId: string | null }>;
  overrides: Array<{ procedureTypeId: string; ymd: string; practitionerId: string }>;
  absent: (practitionerId: string, ymd: string) => boolean;
}): Array<{ allocationId: string; practitionerId: string | null }> {
  const postByType = new Map<string, string[]>();
  for (const post of input.posts) {
    if (!post.practitionerId) continue;
    const list = postByType.get(post.procedureTypeId) ?? [];
    if (!list.includes(post.practitionerId)) list.push(post.practitionerId);
    postByType.set(post.procedureTypeId, list);
  }
  const overrideByKey = new Map(
    input.overrides.map((row) => [
      `${row.procedureTypeId}|${row.ymd}`,
      row.practitionerId,
    ]),
  );
  const busy = input.occupations.map((row) => ({
    practitionerId: row.practitionerId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  }));
  const slots = [...input.slots].sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime() ||
      a.allocationId.localeCompare(b.allocationId),
  );
  const updates: Array<{ allocationId: string; practitionerId: string | null }> = [];
  for (const slot of slots) {
    const overrideId = overrideByKey.get(`${slot.procedureTypeId}|${slot.ymd}`);
    const candidates = overrideId
      ? [overrideId]
      : (postByType.get(slot.procedureTypeId) ?? []);
    let target: string | null = null;
    for (const candidate of candidates) {
      if (input.absent(candidate, slot.ymd)) continue;
      if (
        slot.staffMode === "HARD" &&
        busy.some(
          (row) =>
            row.practitionerId === candidate &&
            row.startsAt < slot.endsAt &&
            row.endsAt > slot.startsAt,
        )
      ) {
        continue;
      }
      target = candidate;
      break;
    }
    updates.push({ allocationId: slot.allocationId, practitionerId: target });
    if (target) {
      busy.push({
        practitionerId: target,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
    }
  }
  return updates;
}
