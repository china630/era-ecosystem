import { bakuDateKey } from "@/lib/baku-day";

export const DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP = 3;

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
