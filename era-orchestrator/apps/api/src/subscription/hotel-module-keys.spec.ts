import {
  consolidateHotelModuleKeys,
  inferPricingCatalogKind,
  isHotelModuleActive,
  resolveHotelModuleKey,
} from "@era365/database";

describe("hotel-module-keys (database export)", () => {
  it("infers catalog kind from key prefix", () => {
    expect(inferPricingCatalogKind("industry_hotel_pms")).toBe("SATELLITE");
    expect(inferPricingCatalogKind("platform_notifications")).toBe("ADDON");
    expect(inferPricingCatalogKind("hotel_core")).toBe("MODULE");
  });

  it("consolidates legacy hotel keys", () => {
    expect(consolidateHotelModuleKeys(["hotel_front_office", "hotel_night_audit"])).toEqual([
      "hotel_core",
    ]);
  });

  it("isHotelModuleActive dual-reads legacy slugs", () => {
    expect(isHotelModuleActive(["hotel_night_audit"], "hotel_core")).toBe(true);
    expect(resolveHotelModuleKey("hotel_contracts_yield")).toBe("hotel_distribution");
  });
});
