import { lookupSpaProduct, normalizeSpaName } from "@/lib/integration/elektraweb-bridge/spa-product-map";
import { buildSpaSavePayload } from "@/lib/integration/elektraweb-bridge/spa-save-payload";

describe("spa-product-map", () => {
  it("resolves captured Nafta codes", () => {
    expect(lookupSpaProduct({ procedureCode: "SVC-OZONTERAPIYA" })?.id).toBe(1516306);
    expect(lookupSpaProduct({ procedureName: "İnqalyasiya" })?.id).toBe(1516305);
    expect(lookupSpaProduct({ procedureName: "Hidrokalon" })?.id).toBe(1516296);
  });

  it("does not guess unknown codes", () => {
    expect(lookupSpaProduct({ procedureCode: "SVC-UNKNOWN", procedureName: "Nope" })).toBeNull();
  });

  it("normalizes Azerbaijani letters", () => {
    expect(normalizeSpaName("Fitoterapiya ( boçka )")).toBe("fitoterapiya bocka");
  });
});

describe("buildSpaSavePayload", () => {
  it("builds in-house Insert without LoginToken or WALKIN", () => {
    const body = buildSpaSavePayload({
      hotelId: 31606,
      depId: 133387,
      currencyId: 10,
      resNameId: 100670215,
      lines: [{ productId: 1516306, serviceName: "Ozonterapiya", price: 17 }],
    });
    const p = body.Parameters as Record<string, unknown>;
    expect(body.LoginToken).toBeUndefined();
    expect(body.Object).toBe("SP_SPA_SAVE");
    expect(p.RESNAMEID).toBe(100670215);
    expect(p.WALKIN).toBeNull();
    expect(p.TOTAL).toBe(17);
    expect(String(p.DETAILDATA)).toContain("1516306");
  });
});
