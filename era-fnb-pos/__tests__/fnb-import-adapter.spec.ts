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

  it("maps product groups with revenue code and skips empty names", () => {
    const row = productGroupsAdapter.mapRow(
      mapHeaders(
        {
          "Group Code": "SOYUQ-ICKILER",
          "Product Group Name": "SOYUQ İÇKİLƏR",
          "Revenue Code": "4102",
          "Display Order": "3",
          Active: "true",
        },
        productGroupsAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({
      code: "SOYUQ-ICKILER",
      name: "SOYUQ İÇKİLƏR",
      sortOrder: 3,
      revenueCode: "4102",
      active: true,
    });
    expect(
      productGroupsAdapter.mapRow(
        mapHeaders({ "Product Group Name": "" }, productGroupsAdapter.headerAliases),
      ),
    ).toBeNull();
  });

  it("maps English product cards and stamps ERA-FNB-{Id} when Product Code is empty", () => {
    const row = productCardsAdapter.mapRow(
      mapHeaders(
        {
          Id: "42",
          "Product Name": "Çay",
          "Product Group Name": "İSTİ İÇKİLƏR",
          Price: "4.5",
          "Revenue Code": "4102",
          Active: "true",
        },
        productCardsAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({
      plu: "ERA-FNB-42",
      name: "Çay",
      price: 4.5,
      groupName: "İSTİ İÇKİLƏR",
      revenueCode: "4102",
      financeSku: "ERA-FNB-42",
      active: true,
    });
  });

  it("maps Finance SKU and Recipe SKU when present", () => {
    const row = productCardsAdapter.mapRow(
      mapHeaders(
        {
          "Product Code": "W1",
          "Product Name": "Wine glass",
          "Product Group Name": "WINE",
          Price: "8",
          "Finance SKU": "W1",
          "Recipe SKU": "W2",
          "Revenue Code": "4103",
        },
        productCardsAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({
      plu: "W1",
      financeSku: "W1",
      recipeSku: "W2",
      revenueCode: "4103",
    });
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
