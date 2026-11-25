import {
  blocksModuleToggleForTier,
  catalogModuleKeyToPatch,
  hasConstructorModulesInCustomConfig,
} from "./billing-module-toggle.helpers";

describe("billing module toggle — tier policy", () => {
  it("does not block à-la-carte toggles for TIER_3 (Enterprise)", () => {
    expect(blocksModuleToggleForTier("TIER_3")).toBe(false);
    expect(blocksModuleToggleForTier("TIER_2")).toBe(false);
    expect(blocksModuleToggleForTier(undefined)).toBe(false);
  });

  it("routes fnb_buffet_planner through extraSlugs (pass-through industry SKU)", () => {
    // isPassThroughCatalogModuleKey from @era365/database — real import in helpers
    const patch = catalogModuleKeyToPatch("fnb_buffet_planner", true);
    expect(patch.extraSlugs).toEqual({ fnb_buffet_planner: true });
  });

  it("maps mgmt_budget_pro onto subscription patch (not UNKNOWN_MODULE)", () => {
    expect(catalogModuleKeyToPatch("mgmt_budget_pro", true)).toEqual({
      mgmt_budget_pro: true,
    });
    expect(catalogModuleKeyToPatch("mgmt_budget_pro", false)).toEqual({
      mgmt_budget_pro: false,
    });
  });

  it("allows marketplace toggle when customConfig has trialPackageId", () => {
    expect(
      hasConstructorModulesInCustomConfig({
        trialPackageId: "default",
        modules: ["industry_fnb_pos", "nas"],
      }),
    ).toBe(false);
  });
});
