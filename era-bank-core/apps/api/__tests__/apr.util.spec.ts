import { computeAprPercent } from "../src/modules/loans/apr.util";

describe("computeAprPercent", () => {
  it("matches known 12% single-maturity cashflows within 0.01pp", () => {
    const principalMinor = 1_000_000;
    const flows = [
      { date: new Date("2026-01-01T00:00:00.000Z"), amountMinor: -principalMinor },
      {
        date: new Date("2027-01-01T00:00:00.000Z"),
        amountMinor: principalMinor * 1.12,
      },
    ];
    const apr = computeAprPercent(flows);
    expect(apr).not.toBeNull();
    expect(apr!).toBeGreaterThanOrEqual(11.99);
    expect(apr!).toBeLessThanOrEqual(12.01);
  });
});