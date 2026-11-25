import { parseTransferQuota, isBathTransferQuota, bathTransferSku } from "@/domain/sanatorium/package-assign-quota";

describe("transfer quota keys are not procedure codes", () => {
  it("parses XFER-from--sku", () => {
    const code = "XFER-SVC-VANNA--SVC-DARSONVAL";
    expect(isBathTransferQuota(code)).toBe(true);
    expect(bathTransferSku(code)).toBe("SVC-DARSONVAL");
    expect(parseTransferQuota(code)).toEqual({
      fromCode: "SVC-VANNA",
      sku: "SVC-DARSONVAL",
    });
  });

  it("legacy XFER-sku has empty from", () => {
    expect(parseTransferQuota("XFER-SVC-DARSONVAL")).toEqual({
      fromCode: "",
      sku: "SVC-DARSONVAL",
    });
  });
});
