import {
  coverageRatioScaled,
  mulRateRound,
} from "../src/common/money-rate.util";

describe("money-rate.util", () => {
  it("mulRateRound keeps bigint amounts (no Number coercion)", () => {
    const huge = 9_007_199_254_740_993n; // past Number safe integer
    const half = mulRateRound(huge, 0.5);
    expect(half).toBe(4_503_599_627_370_497n);
  });

  it("mulRateRound rounds half-up at scale", () => {
    expect(mulRateRound(100n, 0.015)).toBe(2n); // 1.5 → 2
    expect(mulRateRound(100n, 0.011)).toBe(1n);
  });

  it("mulRateRound returns 0 for non-positive rate or amount", () => {
    expect(mulRateRound(0n, 0.5)).toBe(0n);
    expect(mulRateRound(100n, 0)).toBe(0n);
    expect(mulRateRound(100n, Number.NaN)).toBe(0n);
  });

  it("coverageRatioScaled is floor ratio in scale units", () => {
    expect(coverageRatioScaled(25n, 100n, 1_000_000n)).toBe(250_000n);
    expect(coverageRatioScaled(0n, 100n)).toBe(0n);
  });
});
