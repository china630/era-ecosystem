import {
  brandFromRow,
  emptyGuestAppBrand,
  parseGuestAppPatch,
} from "./guest-app-brand";

const ORG = "11111111-1111-1111-1111-111111111111";

describe("guest app brand", () => {
  it("rejects a bad locale and a bad color", () => {
    expect(() => parseGuestAppPatch({ enabled: true, locale: "de" })).toThrow("LOCALE");
    expect(() => parseGuestAppPatch({ enabled: true, primaryColor: "blue" })).toThrow("COLOR");
  });

  it("returns an empty brand when disabled, not another hotel", () => {
    const row = parseGuestAppPatch({
      enabled: false,
      displayName: "Nafta",
      primaryColor: "#112233",
      locale: "az",
    });
    expect(brandFromRow(ORG, row)).toEqual(emptyGuestAppBrand(ORG));
  });

  it("does not inherit a parent brand when this org has no row", () => {
    expect(brandFromRow(ORG, null).displayName).toBeNull();
  });

  it("rejects leadAlertMinutes outside 5|10", () => {
    expect(() =>
      parseGuestAppPatch({ enabled: true, leadAlertMinutes: 7 }),
    ).toThrow("LEAD_ALERT");
  });

  it("keeps catalog fields on an enabled brand", () => {
    const row = parseGuestAppPatch({
      enabled: true,
      displayName: "Sea",
      primaryColor: "#112233",
      locale: "en",
      catalogJson: ["Pool"],
      offersJson: ["Spring"],
      leadAlertMinutes: 5,
      enabledOrderKinds: ["HOUSEKEEPING"],
    });
    const brand = brandFromRow(ORG, row);
    expect(brand.catalogJson).toEqual(["Pool"]);
    expect(brand.offersJson).toEqual(["Spring"]);
    expect(brand.leadAlertMinutes).toBe(5);
    expect(brand.enabledOrderKinds).toEqual(["HOUSEKEEPING"]);
  });
});
