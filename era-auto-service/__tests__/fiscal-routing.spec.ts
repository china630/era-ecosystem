import {
  DEFAULT_OPERATING_MODE,
  shouldFiscalizeOnParent,
} from "../../packages/satellite-kit/src/integration/operating-mode";

describe("auto B2C fiscal routing", () => {
  it("fiscalizes on standalone org", () => {
    expect(shouldFiscalizeOnParent(DEFAULT_OPERATING_MODE)).toBe(false);
  });

  it("skips own KKM when parent owns fiscal", () => {
    expect(
      shouldFiscalizeOnParent({
        mode: "DEPARTMENT",
        parentOrgId: "hotel-1",
        fiscalRouting: "PARENT",
        revenueRouting: "PARENT",
      }),
    ).toBe(true);
  });
});
