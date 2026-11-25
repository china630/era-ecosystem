/**
 * Lab ECL engine — STAGE_FLAT (default) or PD_LGD matrices.
 * Not certified IFRS 9 without methodology + lab signoff.
 *
 * Collateral policy (P1-6): applied **once** —
 * - STAGE_FLAT: net from EAD (outstanding − collateral), then stage rate
 * - PD_LGD: full outstanding as EAD; collateral only via LGD haircut
 */
import {
  coverageRatioScaled,
  mulRateRound,
} from "../../common/money-rate.util";

export const STAGE_RATES: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.1,
  3: 0.5,
};

export type EclMethodology = "STAGE_FLAT" | "PD_LGD";

export type EclMatrices = {
  pdByStage: Record<"1" | "2" | "3", number>;
  /** Lifetime PD by stage (stage 1 often ≈ 12m; 2/3 lifetime). */
  lifetimePdByStage?: Record<"1" | "2" | "3", number>;
  /** Optional score-band uplift: score < 600 → +pdUplift */
  pdLowScoreUplift?: number;
  lgdUnsecured: number;
  lgdSecuredFloor: number;
  /** Undrawn commitment conversion factor (0–1). */
  ccfUndrawn?: number;
  /** Macro scenario weights (lab); must sum ≈ 1. */
  macroWeights?: { base: number; upside: number; downside: number };
  /** Relative ECL multipliers per scenario. */
  macroEclMultipliers?: { base: number; upside: number; downside: number };
  /** EIR annual for discount stub (lab). */
  eirAnnual?: number;
};

export type EclLoanInput = {
  loanId: string;
  outstandingMinor: bigint;
  stage: number;
  collateralAmountMinor: bigint;
  akbScore?: number | null;
  /** Undrawn credit line remaining (CCF applied in PD_LGD lab). */
  undrawnMinor?: bigint;
  /** SICR signals beyond DPD. */
  forbearance?: boolean;
  watchList?: boolean;
};

export type EclLoanResult = {
  loanId: string;
  stage: 1 | 2 | 3;
  stageRate: number;
  pd: number | null;
  lifetimePd: number | null;
  lgd: number | null;
  collateralMinor: bigint;
  eadMinor: bigint;
  eclMinor: bigint;
  sicrTriggered: boolean;
  discounted: boolean;
};

export function normalizeStage(stage: number): 1 | 2 | 3 {
  if (stage >= 3) return 3;
  if (stage === 2) return 2;
  return 1;
}

/** STAGE_FLAT: net collateral from EAD once. PD_LGD: full outstanding. */
export function computeEadMinor(
  outstandingMinor: bigint,
  collateralAmountMinor: bigint,
  methodology: EclMethodology = "STAGE_FLAT",
): bigint {
  if (outstandingMinor <= 0n) return 0n;
  if (methodology === "PD_LGD") {
    return outstandingMinor;
  }
  const ead = outstandingMinor - collateralAmountMinor;
  return ead > 0n ? ead : 0n;
}

export function computeEclMinor(eadMinor: bigint, rate: number): bigint {
  return mulRateRound(eadMinor, rate, 1_000_000);
}

export function resolveLgd(
  outstandingMinor: bigint,
  collateralAmountMinor: bigint,
  matrices: EclMatrices,
): number {
  if (outstandingMinor <= 0n) return matrices.lgdUnsecured;
  const SCALE = 1_000_000n;
  const covScaled = coverageRatioScaled(
    collateralAmountMinor,
    outstandingMinor,
    SCALE,
  );
  if (covScaled <= 0n) return matrices.lgdUnsecured;
  const haircut = Math.min(1, Number(covScaled) / Number(SCALE));
  const lgd =
    matrices.lgdUnsecured * (1 - haircut) +
    matrices.lgdSecuredFloor * haircut;
  return Math.max(matrices.lgdSecuredFloor, Math.min(1, lgd));
}

export function resolvePd(
  stage: 1 | 2 | 3,
  akbScore: number | null | undefined,
  matrices: EclMatrices,
): number {
  let pd = matrices.pdByStage[String(stage) as "1" | "2" | "3"];
  if (
    matrices.pdLowScoreUplift &&
    akbScore != null &&
    akbScore < 600
  ) {
    pd = Math.min(1, pd + matrices.pdLowScoreUplift);
  }
  return pd;
}

export function resolveSicr(input: EclLoanInput, stage: 1 | 2 | 3): boolean {
  if (stage >= 2) return true;
  return Boolean(input.forbearance || input.watchList);
}

export function applyCcfToEad(
  eadMinor: bigint,
  undrawnMinor: bigint | undefined,
  ccf: number | undefined,
): bigint {
  if (!undrawnMinor || undrawnMinor <= 0n || !ccf || ccf <= 0) return eadMinor;
  return eadMinor + mulRateRound(undrawnMinor, ccf);
}

export function weightedMacroEcl(
  baseEclMinor: bigint,
  matrices?: EclMatrices,
): bigint {
  if (!matrices?.macroWeights || !matrices.macroEclMultipliers) {
    return baseEclMinor;
  }
  const w = matrices.macroWeights;
  const m = matrices.macroEclMultipliers;
  const blendedRate =
    m.base * w.base + m.upside * w.upside + m.downside * w.downside;
  return mulRateRound(baseEclMinor, blendedRate);
}

/** Lab EIR discount stub: one-year factor 1/(1+eir). */
export function discountEclLab(
  eclMinor: bigint,
  eirAnnual: number | undefined,
): { eclMinor: bigint; discounted: boolean } {
  if (!eirAnnual || eirAnnual <= 0 || eclMinor <= 0n) {
    return { eclMinor, discounted: false };
  }
  const factor = 1 / (1 + eirAnnual);
  return {
    eclMinor: mulRateRound(eclMinor, factor),
    discounted: true,
  };
}

export function calculateLoanEcl(
  input: EclLoanInput,
  methodology: EclMethodology = "STAGE_FLAT",
  matrices?: EclMatrices,
): EclLoanResult {
  let stage = normalizeStage(input.stage);
  const sicrTriggered = resolveSicr(input, stage);
  if (sicrTriggered && stage === 1) stage = 2;

  const collateralMinor =
    input.collateralAmountMinor > 0n ? input.collateralAmountMinor : 0n;
  let eadMinor = computeEadMinor(
    input.outstandingMinor,
    collateralMinor,
    methodology,
  );
  eadMinor = applyCcfToEad(eadMinor, input.undrawnMinor, matrices?.ccfUndrawn);

  if (methodology === "PD_LGD" && matrices) {
    const pd12 = resolvePd(stage, input.akbScore, matrices);
    const lifetimePd =
      matrices.lifetimePdByStage?.[String(stage) as "1" | "2" | "3"] ??
      (stage === 1 ? pd12 : Math.min(1, pd12 * 1.5));
    const pd = stage === 1 ? pd12 : lifetimePd;
    const lgd = resolveLgd(
      input.outstandingMinor,
      collateralMinor,
      matrices,
    );
    let eclMinor = computeEclMinor(eadMinor, pd * lgd);
    eclMinor = weightedMacroEcl(eclMinor, matrices);
    const disc = discountEclLab(eclMinor, matrices.eirAnnual);
    return {
      loanId: input.loanId,
      stage,
      stageRate: pd * lgd,
      pd: pd12,
      lifetimePd,
      lgd,
      collateralMinor,
      eadMinor,
      eclMinor: disc.eclMinor,
      sicrTriggered,
      discounted: disc.discounted,
    };
  }

  const stageRate = STAGE_RATES[stage];
  let eclMinor = computeEclMinor(eadMinor, stageRate);
  eclMinor = weightedMacroEcl(eclMinor, matrices);
  const disc = discountEclLab(eclMinor, matrices?.eirAnnual);
  return {
    loanId: input.loanId,
    stage,
    stageRate,
    pd: null,
    lifetimePd: null,
    lgd: null,
    collateralMinor,
    eadMinor,
    eclMinor: disc.eclMinor,
    sicrTriggered,
    discounted: disc.discounted,
  };
}

export function calculateEclBatch(
  loans: EclLoanInput[],
  methodology: EclMethodology = "STAGE_FLAT",
  matrices?: EclMatrices,
): {
  results: EclLoanResult[];
  totalEadMinor: bigint;
  totalEclMinor: bigint;
} {
  const results = loans.map((l) =>
    calculateLoanEcl(l, methodology, matrices),
  );
  let totalEadMinor = 0n;
  let totalEclMinor = 0n;
  for (const r of results) {
    totalEadMinor += r.eadMinor;
    totalEclMinor += r.eclMinor;
  }
  return { results, totalEadMinor, totalEclMinor };
}
