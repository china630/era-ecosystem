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
  return "DOCTOR";
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
 * When an approved roster posts a nurse to this procedure, prefer them.
 * If they are absent that day, fall back to the remaining skilled pool.
 * Draft / missing roster ⇒ use the skilled pool unchanged.
 */
export function resolveDutyCandidates(input: {
  rosterStatus: "DRAFT" | "APPROVED" | null;
  postedPractitionerId: string | null;
  posted?: DutyCandidate | null;
  postedAbsent: boolean;
  skilled: DutyCandidate[];
}): DutyCandidate[] {
  if (input.rosterStatus !== "APPROVED" || !input.postedPractitionerId) {
    return input.skilled;
  }
  const posted =
    input.posted ??
    input.skilled.find((p) => p.id === input.postedPractitionerId) ??
    null;
  if (posted && !input.postedAbsent) {
    return [posted];
  }
  return input.skilled.filter((p) => p.id !== input.postedPractitionerId);
}
