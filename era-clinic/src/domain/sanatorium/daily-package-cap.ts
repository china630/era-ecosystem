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

/** Empty stored cap: physio 3, bath 1, paraffin 1. Other blocks are uncapped. */
export function defaultDailyDistinctCap(kind: string | null | undefined): number | null {
  if (kind === "PHYSIO") return 3;
  if (kind === "BATH") return 1;
  if (kind === "PARAFFIN") return 1;
  return null;
}

export function resolveDailyDistinctCap(
  kind: string | null | undefined,
  stored: number | null | undefined,
): number | null {
  if (stored == null || !Number.isFinite(Number(stored))) return defaultDailyDistinctCap(kind);
  const n = Math.floor(Number(stored));
  if (n < 1) return defaultDailyDistinctCap(kind);
  return Math.min(12, n);
}

export type BlockCapSource = {
  procedureCode: string;
  kind?: string | null;
  dailyDistinctCap?: number | null;
};

/** Stored kind wins. Known pool codes still get a family when the row never saved one. */
export function kindForDailyCap(
  code: string,
  kind: string | null | undefined,
): string | null | undefined {
  if (kind) return kind;
  const c = code.trim().toUpperCase();
  if (c === "PHYSIO_POOL" || c.startsWith("PHYSIO_POOL_")) return "PHYSIO";
  if (
    c === "PARAFFIN_POOL" ||
    c.startsWith("PARAFFIN_POOL_") ||
    c.includes("PARAFFIN") ||
    c.includes("PARAFIN")
  ) {
    return "PARAFFIN";
  }
  if (c === "NAFTALAN" || c === "NAFTALAN_BATH" || c.includes("NAFTALAN")) return "BATH";
  return kind;
}

export function capsByBlock(rows: BlockCapSource[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const row of rows) {
    map.set(
      row.procedureCode,
      resolveDailyDistinctCap(kindForDailyCap(row.procedureCode, row.kind), row.dailyDistinctCap),
    );
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
