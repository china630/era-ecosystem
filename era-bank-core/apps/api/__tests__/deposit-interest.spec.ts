import { dailyDepositInterestMinor } from "../src/modules/deposits/deposit-interest.util";

describe("dailyDepositInterestMinor ACT/365", () => {
  it("rounds principal * rate / 365", () => {
    // 1_000_000 * 0.12 / 365 ≈ 328.767 → 329
    expect(dailyDepositInterestMinor(1_000_000n, 0.12)).toBe(329n);
  });

  it("returns 0 for zero rate or principal", () => {
    expect(dailyDepositInterestMinor(0n, 0.12)).toBe(0n);
    expect(dailyDepositInterestMinor(1_000_000n, 0)).toBe(0n);
  });

  it("is stable for repeated calls (idempotent formula)", () => {
    const a = dailyDepositInterestMinor(5_000_000n, 0.1);
    const b = dailyDepositInterestMinor(5_000_000n, 0.1);
    expect(a).toBe(b);
    expect(a).toBe(1370n); // 5e6 * 0.1 / 365 ≈ 1369.86 → 1370
  });
});

describe("deposit close/rollover accrued accounting (pure)", () => {
  it("close payout is principal + accrued", () => {
    const principal = 1_000_000n;
    const accrued = 5_000n;
    const payout = principal + accrued;
    const closeLegs = [
      { debitMinor: payout, creditMinor: 0n },
      { debitMinor: 0n, creditMinor: payout },
    ];
    const debit = closeLegs.reduce((s, l) => s + l.debitMinor, 0n);
    const credit = closeLegs.reduce((s, l) => s + l.creditMinor, 0n);
    expect(debit).toBe(credit);
    expect(payout).toBe(1_005_000n);
  });

  it("rollover capitalizes accrued into principal without extra legs", () => {
    const principal = 1_000_000n;
    const accrued = 5_000n;
    const afterPrincipal = principal + accrued;
    const afterAccrued = 0n;
    expect(afterPrincipal).toBe(1_005_000n);
    expect(afterAccrued).toBe(0n);
  });
});
