import { BadRequestException } from "@nestjs/common";
import {
  assertBalancedLegs,
  mirrorLeg,
  sumByCurrency,
  validateLegShape,
} from "../src/kernel/posting-engine/posting-engine.validation";
import type { PostingLegInput } from "../src/kernel/posting-engine/posting-engine.types";

describe("posting-engine validation", () => {
  const balancedPair: PostingLegInput[] = [
    {
      glAccountId: "gl1",
      branchId: "b1",
      debitMinor: 10000n,
      creditMinor: 0n,
      currency: "AZN",
    },
    {
      glAccountId: "gl2",
      branchId: "b1",
      debitMinor: 0n,
      creditMinor: 10000n,
      currency: "AZN",
    },
  ];

  it("accepts balanced legs", () => {
    expect(() => assertBalancedLegs(balancedPair)).not.toThrow();
  });

  it("rejects unbalanced legs", () => {
    expect(() =>
      assertBalancedLegs([
        ...balancedPair,
        {
          glAccountId: "gl3",
          branchId: "b1",
          debitMinor: 100n,
          creditMinor: 0n,
          currency: "AZN",
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("rejects leg with both debit and credit", () => {
    expect(() =>
      validateLegShape({
        glAccountId: "gl1",
        branchId: "b1",
        debitMinor: 100n,
        creditMinor: 50n,
        currency: "AZN",
      }),
    ).toThrow(BadRequestException);
  });

  it("mirrors leg for reversal", () => {
    const leg: PostingLegInput = {
      glAccountId: "gl1",
      branchId: "b1",
      debitMinor: 5000n,
      creditMinor: 0n,
      currency: "AZN",
    };
    const mirrored = mirrorLeg(leg);
    expect(mirrored.debitMinor).toBe(0n);
    expect(mirrored.creditMinor).toBe(5000n);
    expect(() => assertBalancedLegs([leg, mirrored])).not.toThrow();
  });

  it("sums debits and credits per currency", () => {
    const totals = sumByCurrency(balancedPair);
    expect(totals).toHaveLength(1);
    expect(totals[0].debitMinor).toBe(10000n);
    expect(totals[0].creditMinor).toBe(10000n);
  });
});
