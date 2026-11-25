/**
 * Pure lease origination math for MVP (hire-purchase principal after advance).
 */
import { mulRateRound } from "../../common/money-rate.util";

export type LeaseOriginationShape = {
  catalogValueMinor: bigint;
  advancePaymentMinor: bigint;
  financedPrincipalMinor: bigint;
  residualValueMinor: bigint;
  termMonths: number;
  advancePct: number;
};

export function buildLeaseOriginationShape(input: {
  catalogValueMinor: bigint;
  advancePct: number;
  residualValueMinor: bigint;
  termMonths: number;
}): LeaseOriginationShape {
  if (input.advancePct < 0 || input.advancePct > 100) {
    throw new Error("advancePct must be between 0 and 100");
  }
  if (input.termMonths < 1) {
    throw new Error("termMonths must be at least 1");
  }
  if (input.residualValueMinor < 0n) {
    throw new Error("residualValueMinor must be non-negative");
  }
  const advancePaymentMinor = mulRateRound(
    input.catalogValueMinor,
    input.advancePct / 100,
  );
  let financedPrincipalMinor =
    input.catalogValueMinor - advancePaymentMinor;
  if (financedPrincipalMinor < 0n) {
    financedPrincipalMinor = 0n;
  }
  return {
    catalogValueMinor: input.catalogValueMinor,
    advancePaymentMinor,
    financedPrincipalMinor,
    residualValueMinor: input.residualValueMinor,
    termMonths: input.termMonths,
    advancePct: input.advancePct,
  };
}