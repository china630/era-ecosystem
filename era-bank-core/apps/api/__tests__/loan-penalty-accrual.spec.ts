import {
  dailyPenaltyMinor,
  overdueInstallmentBaseMinor,
} from "../src/modules/loans/loan-interest.util";

describe("loan penalty accrual (10 overdue days)", () => {
  const overdueBase = overdueInstallmentBaseMinor({
    principalMinor: 800_000n,
    interestMinor: 50_000n,
    paidPrincipalMinor: 0n,
    paidInterestMinor: 0n,
  });

  it("sums unpaid principal and interest on overdue installment", () => {
    expect(overdueBase).toBe(850_000n);
  });

  it("accrues penalty for 10 days at ACT/365", () => {
    const penaltyRate = 0.18;
    let total = 0n;
    for (let d = 0; d < 10; d += 1) {
      total += dailyPenaltyMinor(overdueBase, penaltyRate, "ACT_365");
    }
    expect(total).toBeGreaterThan(0n);
    // ~850_000 * 0.18 / 365 * 10 ≈ 4191 minor units (qepiks)
    expect(Number(total)).toBeGreaterThanOrEqual(4100);
    expect(Number(total)).toBeLessThanOrEqual(4300);
  });
});