import { HOTEL_PRICING_MODULE_KEYS } from "@era365/database";
import { buildHotelModuleEntitlements } from "./hotel-module-entitlements.util";

describe("buildHotelModuleEntitlements", () => {
  it("returns one flag per canonical hotel pricing module key", () => {
    const ent = buildHotelModuleEntitlements(["hotel_core", "hotel_housekeeping"]);
    expect(Object.keys(ent)).toHaveLength(HOTEL_PRICING_MODULE_KEYS.length);
    expect(ent.hotel_core).toBe(true);
    expect(ent.hotel_housekeeping).toBe(true);
    expect(ent.hotel_distribution).toBe(false);
  });

  it("resolves legacy slugs to consolidated keys", () => {
    const ent = buildHotelModuleEntitlements([
      "hotel_front_office",
      "hotel_channel_ota",
    ]);
    expect(ent.hotel_core).toBe(true);
    expect(ent.hotel_distribution).toBe(true);
  });
});
