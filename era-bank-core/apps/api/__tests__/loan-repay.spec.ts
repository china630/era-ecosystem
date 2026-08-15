import { InstallmentStatus } from "@era/bank-core-database";
import { allocateRepayment } from "../src/modules/loans/loan-repay.util";
import { computeDaysPastDue } from "../src/modules/loans/loan-risk.util";

function inst(
  overrides: Partial<{
    id: string;
    sequenceNo: number;
    dueDate: Date;
    principalMinor: bigint;
    interestMinor: bigint;
    paidPrincipalMinor: bigint;
    paidInterestMinor: bigint;
    status: InstallmentStatus;
  }>,
) {
  return {
    id: overrides.id ?? "i1",
    sequenceNo: overrides.sequenceNo ?? 1,
    dueDate: overrides.dueDate ?? new Date("2026-01-15T00:00:00.000Z"),
    principalMinor: overrides.principalMinor ?? 100_000n,
    interestMinor: overrides.interestMinor ?? 10_000n,
    paidPrincipalMinor: overrides.paidPrincipalMinor ?? 0n,
    paidInterestMinor: overrides.paidInterestMinor ?? 0n,
    status: overrides.status ?? InstallmentStatus.SCHEDULED,
  };
}

describe("allocateRepayment", () => {
  it("pays full installment interest then principal", () => {
    const result = allocateRepayment([inst({})], 110_000n);
    expect(result.interestTotal).toBe(10_000n);
    expect(result.principalTotal).toBe(100_000n);
    expect(result.patches[0].status).toBe(InstallmentStatus.PAID);
    expect(result.remainingUnallocated).toBe(0n);
  });

  it("partial: interest first then principal", () => {
    const result = allocateRepayment([inst({})], 15_000n);
    expect(result.interestTotal).toBe(10_000n);
    expect(result.principalTotal).toBe(5_000n);
    expect(result.patches[0].status).not.toBe(InstallmentStatus.PAID);
    expect(result.patches[0].paidInterestMinor).toBe(10_000n);
    expect(result.patches[0].paidPrincipalMinor).toBe(5_000n);
  });

  it("waterfall across installments by sequenceNo", () => {
    const rows = [
      inst({ id: "a", sequenceNo: 1, principalMinor: 50_000n, interestMinor: 5_000n }),
      inst({ id: "b", sequenceNo: 2, principalMinor: 50_000n, interestMinor: 4_000n }),
    ];
    const result = allocateRepayment(rows, 60_000n);
    expect(result.interestTotal).toBe(9_000n); // 5k + 4k
    expect(result.principalTotal).toBe(51_000n); // 50k + 1k
    expect(result.patches.find((p) => p.id === "a")?.status).toBe(
      InstallmentStatus.PAID,
    );
    expect(result.patches.find((p) => p.id === "b")?.paidPrincipalMinor).toBe(
      1_000n,
    );
  });

  it("overpay leaves remainingUnallocated after schedule exhausted", () => {
    const result = allocateRepayment([inst({})], 200_000n);
    expect(result.principalTotal + result.interestTotal).toBe(110_000n);
    expect(result.remainingUnallocated).toBe(90_000n);
  });

  it("paid installment excluded from DPD", () => {
    const asOf = new Date("2026-03-01T00:00:00.000Z");
    const dpdBefore = computeDaysPastDue(
      [
        {
          dueDate: new Date("2026-01-15T00:00:00.000Z"),
          status: InstallmentStatus.OVERDUE,
        },
      ],
      asOf,
    );
    expect(dpdBefore).toBeGreaterThan(0);
    const dpdAfter = computeDaysPastDue(
      [
        {
          dueDate: new Date("2026-01-15T00:00:00.000Z"),
          status: InstallmentStatus.PAID,
        },
      ],
      asOf,
    );
    expect(dpdAfter).toBe(0);
  });
});
