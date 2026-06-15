import type { PostingLegInput } from "../posting-engine/posting-engine.types";

export interface CrossBranchWithdrawalInput {
  amountMinor: bigint;
  currency: string;
  customerAccountId: string;
  customerGlAccountId: string;
  homeBranchId: string;
  serviceBranchId: string;
  mfrGlAccountId: string;
  cashGlAccountId: string;
}

/**
 * Builds the 4-leg МФР transaction from TZ §7:
 * Branch A customer liability Dr, MFR A Cr, MFR B Dr, Branch B cash Cr.
 */
export function buildCrossBranchWithdrawalLegs(
  input: CrossBranchWithdrawalInput,
): PostingLegInput[] {
  const { amountMinor, currency } = input;
  return [
    {
      accountId: input.customerAccountId,
      glAccountId: input.customerGlAccountId,
      branchId: input.homeBranchId,
      debitMinor: amountMinor,
      creditMinor: 0n,
      currency,
    },
    {
      glAccountId: input.mfrGlAccountId,
      branchId: input.homeBranchId,
      debitMinor: 0n,
      creditMinor: amountMinor,
      currency,
    },
    {
      glAccountId: input.mfrGlAccountId,
      branchId: input.serviceBranchId,
      debitMinor: amountMinor,
      creditMinor: 0n,
      currency,
    },
    {
      glAccountId: input.cashGlAccountId,
      branchId: input.serviceBranchId,
      debitMinor: 0n,
      creditMinor: amountMinor,
      currency,
    },
  ];
}

export function sumLegDebits(legs: PostingLegInput[]): bigint {
  return legs.reduce((acc, l) => acc + l.debitMinor, 0n);
}

export function sumLegCredits(legs: PostingLegInput[]): bigint {
  return legs.reduce((acc, l) => acc + l.creditMinor, 0n);
}
