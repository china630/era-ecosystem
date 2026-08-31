import { listImportEntities, getImportAdapter } from "@/lib/import/adapters";
import { flatImportEntityOrder } from "@/lib/import/phases";

describe("hotel import wizard catalog", () => {
  it("follows pack-layout #03–#15 without BAR, FnB cards, or retail stock", () => {
    expect(flatImportEntityOrder()).toEqual([
      "revenue-codes",
      "bed-types",
      "room-views",
      "room-types",
      "rate-plans",
      "rooms",
      "agencies",
      "guests",
      "reservations",
      "reservation-notes",
      "folios",
      "package-sell",
      "agency-statement",
    ]);
    const slugs = listImportEntities().map((e) => e.entity);
    expect(slugs).toEqual(flatImportEntityOrder());
    expect(slugs).not.toContain("bar-bootstrap");
    expect(slugs).not.toContain("product-cards");
    expect(slugs).not.toContain("stock-cards");
    expect(listImportEntities().find((e) => e.entity === "rooms")?.order).toBe(8);
    expect(listImportEntities().find((e) => e.entity === "rooms")?.templateHint).toMatch(
      /^08-Rooms\.xlsx/,
    );
    expect(listImportEntities().find((e) => e.entity === "package-sell")?.order).toBe(14);
  });

  it("keeps hidden adapters on the API map", () => {
    expect(getImportAdapter("product-cards")?.entity).toBe("product-cards");
    expect(getImportAdapter("stock-cards")?.entity).toBe("stock-cards");
    expect(getImportAdapter("bar-bootstrap")?.fileless).toBe(true);
  });
});
