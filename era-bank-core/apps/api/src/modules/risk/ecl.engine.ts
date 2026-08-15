/**
 * Lab ECL engine — STAGE_FLAT (default) or PD_LGD matrices.
 * Not certified IFRS 9 without methodology + lab signoff.
 */
export const STAGE_RATES: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.1,
  3: 0.5,
};

export type EclMethodology = "STAGE_FLAT" | "PD_LGD";

export type EclMatrices = {
  pdByStage: Record<"1" | "2" | "3", number>;
  /** Optional score-band uplift: score < 600 → +pdUplift */
  pdLowScoreUplift?: number;
  lgdUnsecured: number;
  lgdSecuredFloor: number;
};

export type EclLoanInput = {
  loanId: string;
  outstandingMinor: bigint;
  stage: number;
  collateralAmountMinor: bigint;
  akbScore?: number | null;
};

export type EclLoanResult = {
  loanId: string;
  stage: 1 | 2 | 3;
  stageRate: number;
  pd: number | null;
  lgd: number | null;
  collateralMinor: bigint;
  eadMinor: bigint;
  eclMinor: bigint;
};

export function normalizeStage(stage: number): 1 | 2 | 3 {
  if (stage >= 3) return 3;
  if (stage === 2) return 2;
  return 1;
}

export function computeEadMinor(
  outstandingMinor: bigint,
  collateralAmountMinor: bigint,
): bigint {
  const ead = outstandingMinor - collateralAmountMinor;
  return ead > 0n ? ead : 0n;
}

export function computeEclMinor(eadMinor: bigint, rate: number): bigint {
  if (eadMinor <= 0n || rate <= 0) return 0n;
  const rateScaled = BigInt(Math.round(rate * 1_000_000));
  const num = eadMinor * rateScaled;
  const den = 1_000_000n;
  return (num + den / 2n) / den;
}

export function resolveLgd(
  outstandingMinor: bigint,
  collateralAmountMinor: bigint,
  matrices: EclMatrices,
): number {
  if (outstandingMinor <= 0n) return matrices.lgdUnsecured;
  const coverage = Number(collateralAmountMinor) / Number(outstandingMinor);
  if (coverage <= 0) return matrices.lgdUnsecured;
  const haircut = Math.min(1, coverage);
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

export function calculateLoanEcl(
  input: EclLoanInput,
  methodology: EclMethodology = "STAGE_FLAT",
  matrices?: EclMatrices,
): EclLoanResult {
  const stage = normalizeStage(input.stage);
  const collateralMinor =
    input.collateralAmountMinor > 0n ? input.collateralAmountMinor : 0n;
  const eadMinor = computeEadMinor(input.outstandingMinor, collateralMinor);

  if (methodology === "PD_LGD" && matrices) {
    const pd = resolvePd(stage, input.akbScore, matrices);
    const lgd = resolveLgd(
      input.outstandingMinor,
      collateralMinor,
      matrices,
    );
    const eclMinor = computeEclMinor(eadMinor, pd * lgd);
    return {
      loanId: input.loanId,
      stage,
      stageRate: pd * lgd,
      pd,
      lgd,
      collateralMinor,
      eadMinor,
      eclMinor,
    };
  }

  const stageRate = STAGE_RATES[stage];
  return {
    loanId: input.loanId,
    stage,
    stageRate,
    pd: null,
    lgd: null,
    collateralMinor,
    eadMinor,
    eclMinor: computeEclMinor(eadMinor, stageRate),
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
