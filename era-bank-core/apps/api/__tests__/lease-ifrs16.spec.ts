import {
  buildFinanceLeaseSchedule,
  buyoutQuoteMinor,
  dailyFinanceIncomeMinor,
} from "../src/modules/leasing/lease-ifrs16.util";

describe("lease IFRS 16 lab util (P1-1)", () => {
  it("builds annuity-style schedule summing to principal", () => {
    const rows = buildFinanceLeaseSchedule({
      netInvestmentMinor: 1_000_000n,
      residualValueMinor: 100_000n,
      termMonths: 12,
      rateAnnual: 0.12,
    });
    expect(rows).toHaveLength(12);
    const principalSum = rows.reduce((s, r) => s + r.principalMinor, 0n);
    expect(principalSum).toBe(900_000n);
    expect(rows[0].interestMinor).toBeGreaterThan(0n);
  });

  it("buyout = residual + remaining principal", () => {
    expect(
      buyoutQuoteMinor({
        residualValueMinor: 50_000n,
        remainingPrincipalMinor: 200_000n,
      }),
    ).toBe(250_000n);
  });

  it("daily finance income is non-negative", () => {
    expect(dailyFinanceIncomeMinor(365_0000n, 0.1)).toBeGreaterThan(0n);
    expect(dailyFinanceIncomeMinor(0n, 0.1)).toBe(0n);
  });
});
