import { buildRecoveryLegs } from "../src/modules/collections/collections-posting.util";
import { buildCashMovementLegs } from "../src/modules/cash/cash-posting.util";
import { assertBalancedLegs } from "../src/kernel/posting-engine/posting-engine.validation";
import { CashMovementKind } from "@era/bank-core-database";

describe("be-collections recovery legs", () => {
  it("recovery with account credits RECOVERY_INCOME", () => {
    const legs = buildRecoveryLegs({
      amountMinor: 10_000n,
      currency: "AZN",
      branchId: "br-1",
      recoveryIncomeGlId: "gl-rec",
      nplWorkoutGlId: "gl-npl",
      creditAccountId: "acc-1",
      creditGlAccountId: "gl-acc",
    });
    assertBalancedLegs(legs);
    expect(legs[0].accountId).toBe("acc-1");
  });

  it("recovery without account uses NPL_WORKOUT → RECOVERY_INCOME", () => {
    const legs = buildRecoveryLegs({
      amountMinor: 10_000n,
      currency: "AZN",
      branchId: "br-1",
      recoveryIncomeGlId: "gl-rec",
      nplWorkoutGlId: "gl-npl",
    });
    assertBalancedLegs(legs);
  });
});

describe("be-collections related cash legs", () => {
  it("vault↔till movement balances for collections branch ops", () => {
    const legs = buildCashMovementLegs({
      kind: CashMovementKind.TILL_TO_VAULT,
      amountMinor: 50_000n,
      currency: "AZN",
      branchId: "br-1",
      cashVaultGlId: "gl-vault",
      tellerTillGlId: "gl-till",
    });
    assertBalancedLegs(legs);
  });
});
