/**
 * Staff ↔ buffet overlap netting (Wave 3).
 * Canon: docs/adr/fnb-buffet-cost-attribution.md §4
 *
 * Invariant: staffGross = staffNet + buffetCoveredFromStaff (no double-count).
 * Residual is only reduced under LEFTOVER_FIRST (feeds staff from leftover pool).
 */

import type { StaffBuffetOverlap } from "@/lib/buffet-cost-settings";

export type StaffBuffetOverlapInput = {
  staffGross: number;
  /** FOOD residual / leftover pool available to feed staff (LEFTOVER_FIRST). */
  buffetResidual: number;
  mode: StaffBuffetOverlap;
  overlapPct: number;
};

export type StaffBuffetOverlapResult = {
  staffGross: number;
  staffNet: number;
  /** Portion of staff gross attributed to buffet (not left on staff center). */
  buffetCoveredFromStaff: number;
  /** Residual after LEFTOVER_FIRST feed; unchanged for other modes. */
  residualAfter: number;
  mode: StaffBuffetOverlap;
  overlapPct: number;
};

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

export function applyStaffBuffetOverlap(
  input: StaffBuffetOverlapInput,
): StaffBuffetOverlapResult {
  const staffGross = money(input.staffGross);
  const buffetResidual = money(input.buffetResidual);
  const overlapPct = clampPct(input.overlapPct);
  const mode = input.mode;

  if (mode === "SEPARATE_CENTER" || staffGross === 0) {
    return {
      staffGross,
      staffNet: staffGross,
      buffetCoveredFromStaff: 0,
      residualAfter: buffetResidual,
      mode,
      overlapPct,
    };
  }

  if (mode === "OVERLAP_PCT") {
    const buffetCoveredFromStaff = money((staffGross * overlapPct) / 100);
    const staffNet = money(staffGross - buffetCoveredFromStaff);
    return {
      staffGross,
      staffNet,
      buffetCoveredFromStaff,
      residualAfter: buffetResidual,
      mode,
      overlapPct,
    };
  }

  // LEFTOVER_FIRST: residual feeds staff need up to overlapPct of staffGross.
  const maxFeed = money((staffGross * overlapPct) / 100);
  const buffetCoveredFromStaff = money(Math.min(buffetResidual, maxFeed));
  const staffNet = money(staffGross - buffetCoveredFromStaff);
  const residualAfter = money(buffetResidual - buffetCoveredFromStaff);
  return {
    staffGross,
    staffNet,
    buffetCoveredFromStaff,
    residualAfter,
    mode,
    overlapPct,
  };
}

/**
 * Build attributed / residual slices for a cost-run export.
 * `posAttributed` is untouched; staff and residual never share the same AZN twice.
 */
export function buildCostRunAttributionSlices(args: {
  foodUsage: number;
  posAttributed: number;
  staffGross: number;
  mode: StaffBuffetOverlap;
  overlapPct: number;
}) {
  const foodUsage = money(args.foodUsage);
  const posAttributed = money(args.posAttributed);
  const preStaffResidual = money(Math.max(0, foodUsage - posAttributed));
  const netting = applyStaffBuffetOverlap({
    staffGross: args.staffGross,
    buffetResidual: preStaffResidual,
    mode: args.mode,
    overlapPct: args.overlapPct,
  });
  const attributed = money(posAttributed + netting.staffNet);
  // Buffet residual after staff netting: usage − pos − staffNet
  // (= preStaffResidual − staffNet for SEPARATE/OVERLAP; for LEFTOVER_FIRST
  //  staffNet already excludes residual feed, so residualAfter matches).
  const residualBuffet = money(foodUsage - attributed);
  return {
    foodUsage,
    posAttributed,
    staffGross: netting.staffGross,
    staffNet: netting.staffNet,
    buffetCoveredFromStaff: netting.buffetCoveredFromStaff,
    attributed,
    residualBuffet,
    residualAfterOverlap: netting.residualAfter,
    overlap: {
      mode: netting.mode,
      overlapPct: netting.overlapPct,
    },
  };
}
