import { omitEmptyLabPrintValue } from "@/lib/lab-result-flags";

describe("omitEmptyLabPrintValue (CLI-34)", () => {
  const lymph = {
    refMin: "0.9",
    refMax: "5.0",
    unit: "#",
    normTextAz: "0.9-5.0 #",
  };

  it("omits empty, dash, and catalog-range echo", () => {
    expect(omitEmptyLabPrintValue("", lymph)).toBe(true);
    expect(omitEmptyLabPrintValue("   ", lymph)).toBe(true);
    expect(omitEmptyLabPrintValue("—", lymph)).toBe(true);
    expect(omitEmptyLabPrintValue("-", lymph)).toBe(true);
    expect(omitEmptyLabPrintValue("–", lymph)).toBe(true);
    expect(omitEmptyLabPrintValue("0.9-5.0 #", lymph)).toBe(true);
  });

  it("keeps a real result", () => {
    expect(omitEmptyLabPrintValue("2.1", lymph)).toBe(false);
    expect(omitEmptyLabPrintValue("POSITIVE", {})).toBe(false);
  });
});
