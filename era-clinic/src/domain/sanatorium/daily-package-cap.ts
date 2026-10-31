import { bakuDateKey } from "@/lib/baku-day";

/** Empty package-block cell. Not a physio/bath/paraffin family default. */
export const DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP = 1;

export type PackageCapSlot = {
  code: string;
  start: Date;
  inPackage: boolean;
};

export function clampDailyPackageProcedureCap(n: number | null | undefined): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP;
  return Math.min(12, Math.max(1, Math.floor(v)));
}

/** Distinct in-package procedure codes already on this Asia/Baku calendar day. */
export function inPackageCodesOnBakuDay(
  slots: PackageCapSlot[],
  day: Date,
): Set<string> {
  const key = bakuDateKey(day);
  const codes = new Set<string>();
  for (const s of slots) {
    if (!s.inPackage) continue;
    if (bakuDateKey(s.start) === key) codes.add(s.code);
  }
  return codes;
}

/**
 * Whether a *new* in-package code is blocked by the daily distinct-SKU cap.
 * Same code already on the day is not a cap miss (same-SKU-once-per-day is separate).
 * Paid extras (`inPackage: false`) never use this helper.
 */
export function packageDayIsFullForNewCode(
  codesOnDay: Set<string>,
  candidateCode: string,
  cap: number,
): boolean {
  const limit = clampDailyPackageProcedureCap(cap);
  if (codesOnDay.has(candidateCode)) return false;
  return codesOnDay.size >= limit;
}

/** @deprecated Kind no longer picks a cap. Empty stored value is 1. */
export function defaultDailyDistinctCap(_kind: string | null | undefined): number {
  return DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP;
}

/** Stored block cell wins. Empty, missing, or below 1 means one distinct procedure that day. */
export function resolveDailyDistinctCap(
  _kind: string | null | undefined,
  stored: number | null | undefined,
): number {
  if (stored == null || !Number.isFinite(Number(stored))) return DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP;
  const n = Math.floor(Number(stored));
  if (n < 1) return DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP;
  return Math.min(12, n);
}

export type BlockCapSource = {
  procedureCode: string;
  kind?: string | null;
  dailyDistinctCap?: number | null;
};

export function capsByBlock(rows: BlockCapSource[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const row of rows) {
    map.set(row.procedureCode, resolveDailyDistinctCap(row.kind, row.dailyDistinctCap));
  }
  return map;
}

export type BlockCapSlot = PackageCapSlot & { quotaKey: string };

/** Distinct in-package SKUs of one package block on this Asia/Baku day. */
export function packageBlockIsFull(input: {
  slots: BlockCapSlot[];
  day: Date;
  candidateCode: string;
  quotaKey: string;
  cap: number | null;
}): boolean {
  if (input.cap == null) return false;
  const key = bakuDateKey(input.day);
  const codes = new Set<string>();
  for (const slot of input.slots) {
    if (!slot.inPackage || slot.quotaKey !== input.quotaKey) continue;
    if (bakuDateKey(slot.start) !== key) continue;
    codes.add(slot.code);
  }
  if (codes.has(input.candidateCode)) return false;
  return codes.size >= input.cap;
}
