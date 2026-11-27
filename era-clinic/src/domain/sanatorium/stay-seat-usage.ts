/**
 * Unified stay-day headcount for one procedure code on the assign card.
 * Package (blue) + unpaid/paid extras (red/amber) share one staySeatMax ceiling.
 */

export type StaySeatParts = {
  packageFact?: number;
  /** Package draft delta still awaiting Saxla (goal − fact hole). */
  packageDraft?: number;
  unpaidExtra?: number;
  paidExtra?: number;
};

function nonNegInt(v?: number): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

/** Total seats counting toward staySeatMax for one procedure code. */
export function staySeatHeadcount(parts: StaySeatParts): number {
  return (
    nonNegInt(parts.packageFact) +
    nonNegInt(parts.packageDraft) +
    nonNegInt(parts.unpaidExtra) +
    nonNegInt(parts.paidExtra)
  );
}

export function exceedsStaySeatMax(headcount: number, staySeatMax: number): boolean {
  return staySeatHeadcount({ packageFact: headcount }) > nonNegInt(staySeatMax);
}

/** True when current headcount already at/over the stay ceiling (no further +). */
export function atStaySeatCap(headcount: number, staySeatMax: number): boolean {
  return staySeatHeadcount({ packageFact: headcount }) >= nonNegInt(staySeatMax);
}

/** True when adding `add` seats would stay within staySeatMax. */
export function canAddStaySeats(
  headcountBefore: number,
  add: number,
  staySeatMax: number,
): boolean {
  const addN = nonNegInt(add);
  if (addN < 1) return true;
  return !exceedsStaySeatMax(headcountBefore + addN, staySeatMax);
}
