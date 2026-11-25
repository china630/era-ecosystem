/**
 * Unified PackageAssign card trash: unlocked package and/or unpaid extras.
 * Paid / locked-only lanes stay non-trashable (folio reverse elsewhere).
 */

export function canTrashAssignLane(input: {
  hasUnlockedPackage: boolean;
  unpaidQty: number;
}): boolean {
  return input.hasUnlockedPackage || input.unpaidQty > 0;
}

export function extraCutKey(code: string, regimeKey: string): string {
  return `${code}|${regimeKey}`;
}

/** Drop all unpaid draft lines for code+regime. */
export function clearExtraDraftForLane<T extends { key: string; procedureCode: string; regimeKey?: string }>(
  draft: T[],
  code: string,
  regimeKey: string,
  regimeOf: (row: T) => string,
): T[] {
  return draft.filter((row) => !(row.procedureCode === code && regimeOf(row) === regimeKey));
}

/**
 * Mark every live pending row for this lane as cut (Saxla `removals`).
 * Returns next cut map; does not touch paid extras.
 */
export function cutAllPendingForLane(
  cut: Record<string, number>,
  code: string,
  regimeKey: string,
  pendingCount: number,
): Record<string, number> {
  const key = extraCutKey(code, regimeKey);
  if (pendingCount < 1) {
    const next = { ...cut };
    delete next[key];
    return next;
  }
  return { ...cut, [key]: pendingCount };
}
