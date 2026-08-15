import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildFeeAssessLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  debitAccountId: string;
  debitGlAccountId: string;
  feeIncomeGlId: string;
  useCashVault?: boolean;
  cashVaultGlId?: string;
}): PostingLegInput[] {
  if (input.useCashVault && input.cashVaultGlId) {
    return [
      {
        glAccountId: input.cashVaultGlId,
        branchId: input.branchId,
        debitMinor: input.amountMinor,
        creditMinor: 0n,
        currency: input.currency,
      },
      {
        glAccountId: input.feeIncomeGlId,
        branchId: input.branchId,
        debitMinor: 0n,
        creditMinor: input.amountMinor,
        currency: input.currency,
      },
    ];
  }
  return [
    {
      accountId: input.debitAccountId,
      glAccountId: input.debitGlAccountId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.feeIncomeGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
