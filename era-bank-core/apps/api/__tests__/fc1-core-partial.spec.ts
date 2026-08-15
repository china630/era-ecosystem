import { BadRequestException } from "@nestjs/common";
import { HoldReason } from "@era/bank-core-database";
import {
  applyPackageWaiver,
  assertOverdraftAllowed,
  computeAvailableBalance,
  fxRevalEmptyResult,
  LEGAL_ARREST_HOLD_REASON,
} from "../src/common/fc1-core.util";

describe("FC-1 LEGAL_ARREST hold", () => {
  it("HoldReason enum includes LEGAL_ARREST", () => {
    expect(LEGAL_ARREST_HOLD_REASON).toBe(HoldReason.LEGAL_ARREST);
    expect(HoldReason.LEGAL_ARREST).toBe("LEGAL_ARREST");
  });

  it("reduces available balance when hold placed", () => {
    const available = computeAvailableBalance({
      ledgerBalanceMinor: 1_000_000n,
      overdraftLimitMinor: 0n,
      activeHoldMinor: 200_000n,
    });
    expect(available).toBe(800_000n);
  });
});

describe("FC-1 overdraft limits", () => {
  it("allows OD when product permits", () => {
    expect(() =>
      assertOverdraftAllowed(50_000n, true, true),
    ).not.toThrow();
  });

  it("rejects OD when product forbids overdraft", () => {
    expect(() =>
      assertOverdraftAllowed(50_000n, false, true),
    ).toThrow(BadRequestException);
  });

  it("soft-allows OD when no product template", () => {
    expect(() =>
      assertOverdraftAllowed(50_000n, false, false),
    ).not.toThrow();
  });

  it("includes overdraft in available balance", () => {
    const available = computeAvailableBalance({
      ledgerBalanceMinor: 100_000n,
      overdraftLimitMinor: 50_000n,
      activeHoldMinor: 0n,
    });
    expect(available).toBe(150_000n);
  });
});

describe("FC-1 package PERCENT waiver on assess", () => {
  it("applies PERCENT waiver before posting amount", () => {
    const base = 10_000n;
    const waived = applyPackageWaiver(base, "PERCENT", 25n);
    expect(waived).toBe(7_500n);
  });

  it("FULL waiver zeroes fee", () => {
    expect(applyPackageWaiver(5_000n, "FULL", null)).toBe(0n);
  });

  it("FIXED_MINOR waiver subtracts fixed amount", () => {
    expect(applyPackageWaiver(5_000n, "FIXED_MINOR", 1_000n)).toBe(4_000n);
  });
});

describe("FC-1 FX revaluation empty path", () => {
  it("returns ok when no FC balances", () => {
    const result = fxRevalEmptyResult();
    expect(result.posted).toBe(0);
    expect(result.currencies).toEqual([]);
    expect(result.pnlMinor).toBe("0");
  });
});
