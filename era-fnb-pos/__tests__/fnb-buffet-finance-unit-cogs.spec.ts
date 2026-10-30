jest.mock("@era/satellite-kit", () => ({
  searchFinanceCatalog: jest.fn(),
}));

import { searchFinanceCatalog } from "@era/satellite-kit";
import { resolveUnitCogsBySkuFromFinance } from "@/lib/buffet-finance-unit-cogs";

const searchMock = searchFinanceCatalog as jest.MockedFunction<typeof searchFinanceCatalog>;

describe("resolveUnitCogsBySkuFromFinance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps Finance unitPrice to unitCogsBySku", async () => {
    searchMock.mockResolvedValue({
      source: "finance",
      items: [
        {
          id: "1",
          sku: "MEAT",
          name: "Meat",
          isService: false,
          revenueAccountCode: null,
          unitPrice: 18,
        },
        {
          id: "2",
          sku: "OIL",
          name: "Oil",
          isService: false,
          revenueAccountCode: null,
          unitPrice: 8.5,
        },
      ],
    });
    const r = await resolveUnitCogsBySkuFromFinance({
      organizationId: "org-1",
      recipeSkus: ["meat", "FLOUR"],
    });
    expect(r.source).toBe("finance");
    expect(r.unitCogsBySku).toEqual({ MEAT: 18 });
    expect(r.missingSkus).toEqual(["FLOUR"]);
  });

  it("returns unavailable when catalog fails", async () => {
    searchMock.mockResolvedValue({ source: "unavailable", items: [] });
    const r = await resolveUnitCogsBySkuFromFinance({
      organizationId: "org-1",
      recipeSkus: ["MEAT"],
    });
    expect(r.source).toBe("unavailable");
    expect(r.unitCogsBySku).toEqual({});
    expect(r.missingSkus).toEqual(["MEAT"]);
  });
});
