jest.mock("@era/satellite-kit", () => ({
  enterSatelliteTenant: jest.fn(),
  resolveSatelliteTenantOrgId: () => "org-test",
  getSatelliteTenantContext: () => ({ organizationId: "org-test" }),
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-test",
}));

import { mapHeaders } from "@/lib/import/helpers";
import { stockCardsAdapter } from "@/lib/import/adapters";
import { IMPORT_PHASES } from "@/lib/import/phases";

describe("Retail cutover import adapter", () => {
  it("catalog phase is stock-cards only", () => {
    expect(IMPORT_PHASES[0]?.entities).toEqual(["stock-cards"]);
  });

  it("stamps ERA-STK-{Id} when Ürün Kodu is empty and skips passive", () => {
    const row = stockCardsAdapter.mapRow(
      mapHeaders(
        { Id: "7", "Ürün Adı": "Soap", Fiyat: "3.2" },
        stockCardsAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({ sku: "ERA-STK-7", description: "Soap", unitPrice: 3.2 });
    expect(
      stockCardsAdapter.mapRow(
        mapHeaders(
          { Id: "8", "Ürün Adı": "Old", Pasif: "true" },
          stockCardsAdapter.headerAliases,
        ),
      ),
    ).toBeNull();
  });
});
