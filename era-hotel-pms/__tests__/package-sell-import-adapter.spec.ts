import { mapHeaders } from "@/lib/import/helpers";
import { packageSellAdapter } from "@/lib/import/adapters/package-sell.adapter";
import { IMPORT_PHASES } from "@/lib/import/phases";

describe("package-sell import adapter", () => {
  it("is in the hotel master phase after rate-plans", () => {
    expect(IMPORT_PHASES.find((p) => p.id === "master")?.entities).toEqual([
      "room-types",
      "bar-bootstrap",
      "rate-plans",
      "package-sell",
      "rooms",
      "agencies",
      "product-cards",
      "stock-cards",
    ]);
  });

  it("imports desk=Y rows and skips desk=N (Junior/Deluxe Standart)", () => {
    const desk = packageSellAdapter.mapRow(
      mapHeaders(
        {
          packageCode: "PKG-STANDART",
          packageName: "Nafta Standart",
          occupancy: 2,
          sellPrice: 349,
          season: "high",
          roomType: "Standart DBL/Twin",
          desk: "Y",
          extraBedAmount: 96,
        },
        packageSellAdapter.headerAliases,
      ),
    );
    expect(desk).toMatchObject({
      packageCode: "PKG-STANDART",
      occupancy: 2,
      sellPrice: 349,
      desk: "Y",
      extraBedAmount: 96,
    });
    expect(
      packageSellAdapter.mapRow(
        mapHeaders(
          {
            packageCode: "PKG-STANDART",
            packageName: "Nafta Standart",
            occupancy: 2,
            sellPrice: 400,
            season: "high",
            roomType: "Junior",
            desk: "N",
          },
          packageSellAdapter.headerAliases,
        ),
      ),
    ).toBeNull();
  });
});
