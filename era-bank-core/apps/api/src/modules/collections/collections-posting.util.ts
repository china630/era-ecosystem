import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildRecoveryLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  recoveryIncomeGlId: string;
  nplWorkoutGlId: string;
  creditAccountId?: string;
  creditGlAccountId?: string;
}): PostingLegInput[] {
  if (input.creditAccountId && input.creditGlAccountId) {
    return [
      {
        accountId: input.creditAccountId,
        glAccountId: input.creditGlAccountId,
        branchId: input.branchId,
        debitMinor: input.amountMinor,
        creditMinor: 0n,
        currency: input.currency,
      },
      {
        glAccountId: input.recoveryIncomeGlId,
        branchId: input.branchId,
        debitMinor: 0n,
        creditMinor: input.amountMinor,
        currency: input.currency,
      },
    ];
  }

  return [
    {
      glAccountId: input.nplWorkoutGlId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.recoveryIncomeGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
