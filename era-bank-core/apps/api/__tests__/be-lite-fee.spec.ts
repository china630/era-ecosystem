import { buildFeeAssessLegs } from "../src/modules/fee/fee-posting.util";
import { assertBalancedLegs } from "../src/kernel/posting-engine/posting-engine.validation";
import { assertIdempotencyKey } from "../src/common/idempotency";

describe("be-lite-fee posting legs", () => {
  it("assess debits account and credits FEE_INCOME", () => {
    const legs = buildFeeAssessLegs({
      amountMinor: 1000n,
      currency: "AZN",
      branchId: "br-1",
      debitAccountId: "acc-1",
      debitGlAccountId: "gl-liab",
      feeIncomeGlId: "gl-fee",
    });
    assertBalancedLegs(legs);
    expect(legs[0].debitMinor).toBe(1000n);
    expect(legs[1].creditMinor).toBe(1000n);
  });

  it("cash vault fee path balances", () => {
    const legs = buildFeeAssessLegs({
      amountMinor: 500n,
      currency: "AZN",
      branchId: "br-1",
      debitAccountId: "acc-1",
      debitGlAccountId: "gl-vault",
      feeIncomeGlId: "gl-fee",
      useCashVault: true,
      cashVaultGlId: "gl-vault",
    });
    assertBalancedLegs(legs);
  });
});

describe("idempotency negative path", () => {
  it("rejects short keys", () => {
    expect(() => assertIdempotencyKey("short")).toThrow();
  });
});
