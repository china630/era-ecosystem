import {
  DEFAULT_OPERATING_MODE,
  parseOperatingMode,
  shouldFiscalizeOnParent,
  shouldRouteRevenueToParent,
} from "../../packages/satellite-kit/src/integration/operating-mode";

describe("org operating mode routing", () => {
  it("defaults to standalone own routing", () => {
    expect(parseOperatingMode(null)).toEqual(DEFAULT_OPERATING_MODE);
    expect(shouldRouteRevenueToParent(DEFAULT_OPERATING_MODE)).toBe(false);
    expect(shouldFiscalizeOnParent(DEFAULT_OPERATING_MODE)).toBe(false);
  });

  it("routes department with PARENT flags to parent", () => {
    const mode = parseOperatingMode({
      operatingMode: {
        mode: "DEPARTMENT",
        parentOrgId: "hotel-org",
        fiscalRouting: "PARENT",
        revenueRouting: "PARENT",
      },
    });
    expect(shouldRouteRevenueToParent(mode)).toBe(true);
    expect(shouldFiscalizeOnParent(mode)).toBe(true);
  });
});
