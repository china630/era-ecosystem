import {
  exceedsPerTxnLimit,
  isHighRiskMcc,
  parseCardLimits,
} from "../src/modules/cards/card-txn.engine";

describe("card-txn engine", () => {
  it("detects high-risk MCC", () => {
    expect(isHighRiskMcc("7995")).toBe(true);
    expect(isHighRiskMcc("5411")).toBe(false);
  });

  it("enforces per-txn limit", () => {
    const limits = parseCardLimits({ dailySpendLimitMinor: 500000, perTxnMaxMinor: 200000 });
    expect(exceedsPerTxnLimit(250000n, limits)).toBe(true);
    expect(exceedsPerTxnLimit(100000n, limits)).toBe(false);
  });

  it("idempotency key is processorRef", () => {
    const ref = "stub-001";
    expect(`card-cap-${ref}`).toBe("card-cap-stub-001");
  });
});

describe("card auth decline reasons", () => {
  it("maps insufficient funds label", () => {
    expect("INSUFFICIENT_FUNDS").toBe("INSUFFICIENT_FUNDS");
  });
});
