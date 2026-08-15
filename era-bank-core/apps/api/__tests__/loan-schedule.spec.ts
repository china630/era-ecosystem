import { buildLoanSchedule } from "../src/modules/loans/loan-schedule.util";

describe("buildLoanSchedule", () => {
  it("builds annuity installments", () => {
    const rows = buildLoanSchedule({
      kind: "LOAN_ANNUITY",
      principalMinor: 1_000_000n,
      termMonths: 12,
      rateAnnual: 0.12,
    });
    expect(rows).toHaveLength(12);
    const principalSum = rows.reduce((s, r) => s + r.principalMinor, 0n);
    expect(principalSum).toBe(1_000_000n);
  });

  it("builds declining-balance installments", () => {
    const rows = buildLoanSchedule({
      kind: "LOAN_DIFF",
      principalMinor: 1_200_000n,
      termMonths: 12,
      rateAnnual: 0.12,
    });
    expect(rows).toHaveLength(12);
    expect(rows[0].principalMinor).toBe(100_000n);
    const principalSum = rows.reduce((s, r) => s + r.principalMinor, 0n);
    expect(principalSum).toBe(1_200_000n);
  });
});
