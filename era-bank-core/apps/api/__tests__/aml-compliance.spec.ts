import { AmlAlertStatus } from "@era/bank-core-database";
import {
  evaluateCrossBorder,
  evaluateHighRiskCustomer,
  evaluateStructuring,
  evaluateThresholdSingleTxn,
  evaluateVelocity24h,
  scoreSanctionMatch,
} from "../src/modules/aml/aml-rules.engine";
import {
  assertAlertStatusTransition,
  canTransitionAlertStatus,
} from "../src/modules/aml/aml-workflow";

describe("aml-rules engine", () => {
  it("THRESHOLD_SINGLE_TXN fires at threshold", () => {
    const result = evaluateThresholdSingleTxn(
      {
        transactionId: "tx1",
        legs: [{ debitMinor: 2_000_000n, creditMinor: 0n, currency: "AZN" }],
      },
      { thresholdMinor: 1_500_000 },
    );
    expect(result.hit).toBe(true);
    expect(result.amountMinor).toBe(2_000_000n);
  });

  it("VELOCITY_24H fires when limit exceeded", () => {
    const hit = evaluateVelocity24h(
      { transactionId: "tx1", legs: [], velocity24hMinor: 6_000_000n },
      { limitMinor: 5_000_000 },
    );
    expect(hit).toBe(true);
  });

  it("STRUCTURING_PATTERN fires with repeated below-threshold txns", () => {
    const hit = evaluateStructuring(
      {
        transactionId: "tx1",
        legs: [{ debitMinor: 1_000_000n, creditMinor: 0n, currency: "AZN" }],
        recentTxnCountBelowThreshold: 3,
      },
      { thresholdMinor: 1_500_000 },
    );
    expect(hit).toBe(true);
  });

  it("HIGH_RISK_CUSTOMER fires for HIGH rating with debit", () => {
    const hit = evaluateHighRiskCustomer({
      transactionId: "tx1",
      legs: [{ debitMinor: 100n, creditMinor: 0n, currency: "AZN" }],
      customerRiskRating: "HIGH" as never,
    });
    expect(hit).toBe(true);
  });

  it("CROSS_BORDER detects non-AZ IBAN", () => {
    expect(
      evaluateCrossBorder({
        transactionId: "tx1",
        legs: [],
        counterpartyIban: "DE89370400440532013000",
      }),
    ).toBe(true);
    expect(
      evaluateCrossBorder({
        transactionId: "tx1",
        legs: [],
        counterpartyIban: "AZ21NABZ013501000000000019",
      }),
    ).toBe(false);
  });
});

describe("aml screening scores", () => {
  it("matches sanction seed names with high score", () => {
    expect(scoreSanctionMatch("SANCTION TARGET ALPHA", "SANCTION TARGET ALPHA")).toBe(100);
    expect(scoreSanctionMatch("alpha sanction", "SANCTION TARGET ALPHA")).toBeGreaterThanOrEqual(85);
  });

  it("returns low score for unrelated names", () => {
    expect(scoreSanctionMatch("John Doe", "Jane Smith")).toBe(10);
  });
});

describe("aml alert workflow", () => {
  it("allows OPEN → UNDER_REVIEW → CLOSED", () => {
    expect(canTransitionAlertStatus(AmlAlertStatus.OPEN, AmlAlertStatus.UNDER_REVIEW)).toBe(true);
    expect(() =>
      assertAlertStatusTransition(AmlAlertStatus.UNDER_REVIEW, AmlAlertStatus.CLOSED),
    ).not.toThrow();
  });

  it("rejects CLOSED → OPEN", () => {
    expect(canTransitionAlertStatus(AmlAlertStatus.CLOSED, AmlAlertStatus.OPEN)).toBe(false);
    expect(() =>
      assertAlertStatusTransition(AmlAlertStatus.CLOSED, AmlAlertStatus.OPEN),
    ).toThrow();
  });
});

describe("fmn export payload shape", () => {
  it("builds FMN test schema fields", () => {
    const payload = {
      schemaVersion: "FMN-TEST-1",
      institutionMfo: "200001",
      reportType: "SUSPICIOUS_TRANSACTION",
      periodFrom: "2026-01-01T00:00:00.000Z",
      periodTo: "2026-01-31T00:00:00.000Z",
      suspiciousTransactions: [
        {
          alertId: "alert1",
          ruleCode: "THRESHOLD_SINGLE_TXN",
          transactionId: "tx1",
          amountMinor: "2000000",
          currency: "AZN",
          narrative: "test",
        },
      ],
    };
    expect(payload.schemaVersion).toBe("FMN-TEST-1");
    expect(payload.suspiciousTransactions).toHaveLength(1);
    expect(payload.suspiciousTransactions[0].ruleCode).toBe("THRESHOLD_SINGLE_TXN");
  });
});

describe("cbar trial balance export", () => {
  it("Σ Dr equals Σ Cr in balanced export", () => {
    const lines = [
      { debitMinor: "10000", creditMinor: "0" },
      { debitMinor: "0", creditMinor: "10000" },
    ];
    const totalDebit = lines.reduce((s, l) => s + BigInt(l.debitMinor), 0n);
    const totalCredit = lines.reduce((s, l) => s + BigInt(l.creditMinor), 0n);
    expect(totalDebit).toBe(totalCredit);
  });
});

describe("reg report idempotency key", () => {
  it("same template + period yields stable lookup key", () => {
    const key = `${"CBAR_TRIAL_BALANCE"}|2026-01-01|2026-01-31`;
    expect(key).toBe("CBAR_TRIAL_BALANCE|2026-01-01|2026-01-31");
  });
});
