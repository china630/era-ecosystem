import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildStandingOrderRunLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  fromAccountId: string;
  fromGlAccountId: string;
  clearingGlId: string;
}): PostingLegInput[] {
  return [
    {
      accountId: input.fromAccountId,
      glAccountId: input.fromGlAccountId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.clearingGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
