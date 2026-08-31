jest.mock("@era/satellite-kit", () => ({
  enterSatelliteTenant: jest.fn(),
  resolveSatelliteTenantOrgId: () => "org-test",
  getSatelliteTenantContext: () => ({ organizationId: "org-test" }),
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-test",
}));

import { mapHeaders } from "@/lib/import/helpers";
import {
  fnbTransactionsAdapter,
  productCardsAdapter,
  productGroupsAdapter,
} from "@/lib/import/adapters";
import { IMPORT_PHASES } from "@/lib/import/phases";

describe("F&B cutover import adapters", () => {
  it("catalog then archive phases", () => {
    expect(IMPORT_PHASES.map((p) => p.id)).toEqual(["catalog", "archive"]);
    expect(IMPORT_PHASES[0]?.entities).toEqual(["product-groups", "product-cards"]);
    expect(IMPORT_PHASES[1]?.entities).toEqual(["fnb-transactions"]);
  });

  it("maps product groups and skips empty names", () => {
    const row = productGroupsAdapter.mapRow(
      mapHeaders(
        { "Group Code": "ERA-PG-1", "Product Group Name": "Drinks", "Display Order": "3" },
        productGroupsAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({ code: "ERA-PG-1", name: "Drinks", sortOrder: 3 });
    expect(
      productGroupsAdapter.mapRow(
        mapHeaders({ "Product Group Name": "" }, productGroupsAdapter.headerAliases),
      ),
    ).toBeNull();
  });

  it("stamps ERA-FNB-{Id} when Ürün Kodu is empty", () => {
    const row = productCardsAdapter.mapRow(
      mapHeaders(
        { Id: "42", "Ürün Adı": "Çay", Fiyat: "4.5" },
        productCardsAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({ plu: "ERA-FNB-42", name: "Çay", price: 4.5 });
  });

  it("skips POS PAYMENT and non-positive amounts", () => {
    expect(
      fnbTransactionsAdapter.mapRow(
        mapHeaders(
          { Id: "1", "Local Amount": "10", Notes: "POS PAYMENT" },
          fnbTransactionsAdapter.headerAliases,
        ),
      ),
    ).toBeNull();
    expect(
      fnbTransactionsAdapter.mapRow(
        mapHeaders(
          { Id: "2", "Local Amount": "0", Income: "Çay" },
          fnbTransactionsAdapter.headerAliases,
        ),
      ),
    ).toBeNull();
    expect(
      fnbTransactionsAdapter.mapRow(
        mapHeaders(
          {
            Id: "99",
            Income: "Çay",
            "Local Amount": "12.50",
            "Guest Name": "Walk-in",
          },
          fnbTransactionsAdapter.headerAliases,
        ),
      ),
    ).toMatchObject({
      externalRef: "ew:fnb:99",
      description: "Çay",
      amount: 12.5,
    });
  });
});
