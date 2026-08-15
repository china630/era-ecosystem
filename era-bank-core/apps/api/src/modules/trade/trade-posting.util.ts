import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildLcIssueContingentLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  contingentAssetGlId: string;
  contingentLiabilityGlId: string;
}): PostingLegInput[] {
  return [
    {
      glAccountId: input.contingentAssetGlId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.contingentLiabilityGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
