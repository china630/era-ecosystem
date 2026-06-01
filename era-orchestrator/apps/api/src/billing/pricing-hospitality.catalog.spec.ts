import {
  PRICING_HOSPITALITY_BUNDLE_MARKETING,
  PRICING_HOSPITALITY_MODULE_REGISTRY,
} from "../billing/pricing-hospitality.catalog";

describe("pricing-hospitality.catalog", () => {
  it("registers satellite gate plus 9 hotel submodules", () => {
    const gates = PRICING_HOSPITALITY_MODULE_REGISTRY.filter((m) => m.isSatelliteGate);
    const subs = PRICING_HOSPITALITY_MODULE_REGISTRY.filter((m) => !m.isSatelliteGate);
    expect(gates).toHaveLength(1);
    expect(gates[0]?.moduleKeys).toEqual(["industry_hotel_pms"]);
    expect(subs).toHaveLength(9);
  });

  it("uses consolidated keys in bundle marketing", () => {
    const city = PRICING_HOSPITALITY_BUNDLE_MARKETING.find((b) => b.marketingId === "hotel_city");
    expect(city?.matchModuleKeys).toEqual(["hotel_core", "hotel_housekeeping"]);
    expect(city?.matchModuleKeys).not.toContain("hotel_front_office");
  });
});
