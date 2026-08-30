import { mapHeaders } from "@/lib/import/helpers";
import { productCardsAdapter } from "@/lib/import/adapters/products.adapter";

describe("product-cards import adapter", () => {
  it("maps Turkish EW headers and keeps stamped ERA-FNB code", () => {
    const mapped = mapHeaders(
      {
        Id: 1525893,
        "Ürün Kodu": "ERA-FNB-1525893",
        "Ürün Adı": "Coca Cola",
        "Ürün Grubu Adı": "SOYUQ İÇKİLƏR",
        Fiyat: 3.5,
        Döviz: "AZN",
        "Gelir Grubu": "BEVERAGE",
        KDV: 18,
      },
      productCardsAdapter.headerAliases,
    );
    expect(productCardsAdapter.mapRow(mapped)).toMatchObject({
      code: "ERA-FNB-1525893",
      name: "Coca Cola",
      groupName: "SOYUQ İÇKİLƏR",
      price: 3.5,
      currency: "AZN",
      revenueGroup: "BEVERAGE",
      vatRate: 18,
    });
  });

  it("synthesizes ERA-FNB-{Id} when Ürün Kodu is empty", () => {
    const mapped = mapHeaders(
      { Id: 1, "Ürün Adı": "Su", Fiyat: 1 },
      productCardsAdapter.headerAliases,
    );
    expect(productCardsAdapter.mapRow(mapped)).toMatchObject({
      code: "ERA-FNB-1",
      name: "Su",
    });
  });
});
