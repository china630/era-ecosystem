import { buildStandingOrderRunLegs } from "../src/modules/payments/standing-order-posting.util";
import { assertBalancedLegs } from "../src/kernel/posting-engine/posting-engine.validation";

describe("be-deep-standing-order runDue legs", () => {
  it("standing order debits from account credits STANDING_ORDER_CLEARING", () => {
    const legs = buildStandingOrderRunLegs({
      amountMinor: 200_000n,
      currency: "AZN",
      branchId: "br-1",
      fromAccountId: "acc-1",
      fromGlAccountId: "gl-acc",
      clearingGlId: "gl-so-clear",
    });
    assertBalancedLegs(legs);
    expect(legs[0].debitMinor).toBe(200_000n);
    expect(legs[1].creditMinor).toBe(200_000n);
  });
});
