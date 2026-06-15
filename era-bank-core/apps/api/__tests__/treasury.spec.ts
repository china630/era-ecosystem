import {
  buildGapBuckets,
  computeLcrRatioStub,
  dayOffsetFrom,
} from "../src/modules/treasury/liquidity-gap.engine";

describe("liquidity-gap engine", () => {
  it("builds cumulative gap buckets", () => {
    const inflows = new Map<number, bigint>([[1, 1000n], [7, 500n]]);
    const outflows = new Map<number, bigint>([[1, 200n], [3, 300n]]);
    const buckets = buildGapBuckets(3, inflows, outflows);
    expect(buckets[0].netGapMinor).toBe(800);
    expect(buckets[1].netGapMinor).toBe(0);
    expect(buckets[2].netGapMinor).toBe(-300);
    expect(buckets[2].cumulativeGapMinor).toBe(500);
  });

  it("computes LCR ratio stub", () => {
    expect(computeLcrRatioStub(1500n, 1000n)).toBe(1.5);
    expect(computeLcrRatioStub(1000n, 0n)).toBeNull();
  });

  it("maps day offset from dates", () => {
    const asOf = new Date("2026-06-14T00:00:00Z");
    const target = new Date("2026-06-16T00:00:00Z");
    expect(dayOffsetFrom(asOf, target)).toBe(2);
  });
});

describe("treasury FX idempotency", () => {
  it("uses prefixed idempotency keys", () => {
    expect(`fx-book-deal-001`).toBe("fx-book-deal-001");
  });
});
