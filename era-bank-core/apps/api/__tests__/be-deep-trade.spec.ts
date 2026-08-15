import { buildLcIssueContingentLegs } from "../src/modules/trade/trade-posting.util";
import { assertBalancedLegs } from "../src/kernel/posting-engine/posting-engine.validation";

describe("be-deep-trade LC contingent legs", () => {
  it("LC issue debits TRADE_CONTINGENT_ASSET credits TRADE_CONTINGENT_LIABILITY", () => {
    const legs = buildLcIssueContingentLegs({
      amountMinor: 1_000_000n,
      currency: "AZN",
      branchId: "br-1",
      contingentAssetGlId: "gl-tca",
      contingentLiabilityGlId: "gl-tcl",
    });
    assertBalancedLegs(legs);
    expect(legs[0].glAccountId).toBe("gl-tca");
    expect(legs[0].debitMinor).toBe(1_000_000n);
    expect(legs[1].glAccountId).toBe("gl-tcl");
    expect(legs[1].creditMinor).toBe(1_000_000n);
  });

  it("rejects zero amount at validation layer", () => {
    const legs = buildLcIssueContingentLegs({
      amountMinor: 0n,
      currency: "AZN",
      branchId: "br-1",
      contingentAssetGlId: "gl-tca",
      contingentLiabilityGlId: "gl-tcl",
    });
    expect(() => assertBalancedLegs(legs)).toThrow();
  });
});
