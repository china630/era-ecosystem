import { getProductGlCode } from "../src/common/product-gl";

describe("getProductGlCode", () => {
  it("reads required GL mapping keys", () => {
    expect(
      getProductGlCode(
        { glAssetCode: "1300101", glInterestIncomeCode: "4100101" },
        "glAssetCode",
      ),
    ).toBe("1300101");
  });

  it("rejects missing keys", () => {
    expect(() => getProductGlCode({ glAssetCode: "1300101" }, "glInterestIncomeCode")).toThrow(
      /glInterestIncomeCode/,
    );
  });

  it("rejects empty / non-object params", () => {
    expect(() => getProductGlCode(null, "glLiabilityCode")).toThrow(/paramsJson/);
    expect(() => getProductGlCode({ glLiabilityCode: "  " }, "glLiabilityCode")).toThrow(
      /glLiabilityCode/,
    );
  });
});
