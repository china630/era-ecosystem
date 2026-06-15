import { BadRequestException } from "@nestjs/common";
import { assertBalancedLegs } from "../src/kernel/posting-engine/posting-engine.validation";
import {
  buildCrossBranchWithdrawalLegs,
  sumLegCredits,
  sumLegDebits,
} from "../src/kernel/branch/interbranch.builder";

/** TZ §7 — customer of Branch A withdraws 100 AZN cash at Branch B. */
describe("interbranch MFR (МФР)", () => {
  const amountMinor = 10000n; // 100.00 AZN in qəpik

  const legs = buildCrossBranchWithdrawalLegs({
    amountMinor,
    currency: "AZN",
    customerAccountId: "acc-customer-a",
    customerGlAccountId: "gl-liability",
    homeBranchId: "branch-a",
    serviceBranchId: "branch-b",
    mfrGlAccountId: "gl-mfr",
    cashGlAccountId: "gl-cash",
  });

  it("builds four legs", () => {
    expect(legs).toHaveLength(4);
  });

  it("keeps Σ debit == Σ credit (200 AZN total legs per TZ table)", () => {
    expect(sumLegDebits(legs)).toBe(20000n);
    expect(sumLegCredits(legs)).toBe(20000n);
    expect(() => assertBalancedLegs(legs)).not.toThrow();
  });

  it("tags customer leg to home branch and cash leg to service branch", () => {
    expect(legs[0].branchId).toBe("branch-a");
    expect(legs[0].accountId).toBe("acc-customer-a");
    expect(legs[0].debitMinor).toBe(amountMinor);
    expect(legs[3].branchId).toBe("branch-b");
    expect(legs[3].creditMinor).toBe(amountMinor);
  });

  it("nets MFR control account to zero across branches", () => {
    const mfrA = legs[1];
    const mfrB = legs[2];
    expect(mfrA.glAccountId).toBe("gl-mfr");
    expect(mfrB.glAccountId).toBe("gl-mfr");
    expect(mfrA.creditMinor - mfrA.debitMinor + (mfrB.creditMinor - mfrB.debitMinor)).toBe(0n);
  });

  it("rejects invalid builder output if amount is zero", () => {
    const zeroLegs = buildCrossBranchWithdrawalLegs({
      amountMinor: 0n,
      currency: "AZN",
      customerAccountId: "acc",
      customerGlAccountId: "gl",
      homeBranchId: "a",
      serviceBranchId: "b",
      mfrGlAccountId: "mfr",
      cashGlAccountId: "cash",
    });
    expect(() => assertBalancedLegs(zeroLegs)).toThrow(BadRequestException);
  });
});
