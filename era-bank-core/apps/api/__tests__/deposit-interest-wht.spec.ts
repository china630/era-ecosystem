import { computeDepositInterestWht } from "../src/modules/deposits/deposit-interest-wht.util";

describe("computeDepositInterestWht", () => {
  const base = {
    accrualMonthKey: "2026-11",
    businessMonthKey: "2026-11",
    taxExemptMonthlyMinor: 20_000,
    depositInterestTaxRate: 0.1,
    termMonths: 12,
  };

  it("returns zero WHT when product tax params would be off (rate zero)", () => {
    const r = computeDepositInterestWht({
      ...base,
      dailyInterestMinor: 50_000n,
      monthInterestAccruedMinor: 0n,
      depositInterestTaxRate: 0,
    });
    expect(r.whtMinor).toBe(0n);
    expect(r.netInterestMinor).toBe(50_000n);
  });

  it("taxes incremental interest above monthly exempt (500 AZN/mo → tax on 300 AZN)", () => {
    const monthSoFar = 45_000n;
    const daily = 5_000n;
    const r = computeDepositInterestWht({
      ...base,
      dailyInterestMinor: daily,
      monthInterestAccruedMinor: monthSoFar,
    });
    // Month after = 50_000; taxable increment = 50_000 - 20_000 - (45_000 - 20_000) = 5_000
    expect(r.whtMinor).toBe(500n);
    expect(r.netInterestMinor).toBe(4_500n);
    expect(r.monthInterestAccruedMinor).toBe(50_000n);
  });

  it("exempts long-term deposits when exemptIfTermMonths met", () => {
    const r = computeDepositInterestWht({
      ...base,
      dailyInterestMinor: 50_000n,
      monthInterestAccruedMinor: 0n,
      termMonths: 18,
      exemptIfTermMonths: 18,
    });
    expect(r.whtMinor).toBe(0n);
    expect(r.netInterestMinor).toBe(50_000n);
    expect(r.enabled).toBe(true);
  });

  it("resets month accumulator when business month changes", () => {
    const r = computeDepositInterestWht({
      ...base,
      accrualMonthKey: "2026-10",
      businessMonthKey: "2026-11",
      dailyInterestMinor: 30_000n,
      monthInterestAccruedMinor: 99_000n,
    });
    expect(r.monthInterestAccruedMinor).toBe(30_000n);
    expect(r.whtMinor).toBe(1_000n);
  });
});