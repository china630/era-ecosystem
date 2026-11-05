import { enrichResultLines } from "@/lib/lab-result-flags";
import {
  formatNormDisplay,
  isCatalogNormEcho,
  resolveNumericBounds,
} from "@/lib/lab-analyte-norms";

describe("lab analyte norms", () => {
  const crea = {
    boundKind: "INTERVAL" as const,
    normTextAz: "53-97 µmol/l (qadın); 80-115 µmol/l (kişi)",
    normTextEn: "53-97 µmol/l (female); 80-115 µmol/l (male)",
    normTextRu: "53-97 µmol/l (жен); 80-115 µmol/l (муж)",
    refMinFemale: "53",
    refMaxFemale: "97",
    refMinMale: "80",
    refMaxMale: "115",
    unit: "µmol/l",
  };

  it("treats a copied catalog range as an empty result", () => {
    const lymph = {
      refMin: "0.9",
      refMax: "5.0",
      unit: "#",
      normTextAz: "0.9-5.0 #",
    };
    expect(isCatalogNormEcho("0.9-5.0 #", lymph)).toBe(true);
    expect(isCatalogNormEcho("2.1", lymph)).toBe(false);
    const line = enrichResultLines([{ code: "LYMPH#", value: "0.9-5.0 #", ...lymph }]);
    expect(line[0].value).toBe("—");
    expect(line[0].normTextAz).toBeUndefined();
    expect(line[0].flag).toBeUndefined();
  });

  it("prints the blank sentence without appending unit", () => {
    expect(formatNormDisplay(crea, { lang: "az" })).toBe(
      "53-97 µmol/l (qadın); 80-115 µmol/l (kişi)",
    );
  });

  it("flags creatinine by sex", () => {
    const female = enrichResultLines([
      { code: "CREA", value: "100", ...crea, sex: "FEMALE" },
    ]);
    expect(female[0].flag).toBe("HIGH");
    expect(female[0].refMin).toBe("53");
    expect(female[0].refMax).toBe("97");

    const male = enrichResultLines([
      { code: "CREA", value: "100", ...crea, sex: "MALE" },
    ]);
    expect(male[0].flag).toBe("NORMAL");
    expect(male[0].refMin).toBe("80");
    expect(male[0].refMax).toBe("115");
  });

  it("does not invent a sex when UNKNOWN inside the union", () => {
    const mid = enrichResultLines([
      { code: "CREA", value: "100", ...crea, sex: "UNKNOWN" },
    ]);
    expect(mid[0].flag).toBe("NORMAL");
    expect(mid[0].refMin).toBeUndefined();
    expect(mid[0].refMax).toBeUndefined();

    const high = enrichResultLines([
      { code: "CREA", value: "200", ...crea, sex: "UNKNOWN" },
    ]);
    expect(high[0].flag).toBe("CRITICAL");
  });

  it("treats UPPER_ONLY without marking low values", () => {
    const [row] = enrichResultLines([
      {
        code: "ALT",
        value: "10",
        boundKind: "UPPER_ONLY",
        refMax: "40",
        normTextAz: "≤40 U/l",
      },
    ]);
    expect(row.flag).toBe("NORMAL");
    const [high] = enrichResultLines([
      {
        code: "ALT",
        value: "55",
        boundKind: "UPPER_ONLY",
        refMax: "40",
      },
    ]);
    expect(high.flag).toBe("HIGH");
  });

  it("flags vitamin D zones against the in-range band", () => {
    const zonesJson = JSON.stringify([
      { code: "severe", max: "10", inRange: false },
      { code: "deficit", min: "10", max: "30", inRange: false },
      { code: "ok", min: "30", max: "70", inRange: true },
      { code: "toxic", min: "70", inRange: false },
    ]);
    expect(
      enrichResultLines([
        { code: "VITD", value: "25", boundKind: "ZONES", zonesJson },
      ])[0].flag,
    ).toBe("LOW");
    expect(
      enrichResultLines([
        { code: "VITD", value: "50", boundKind: "ZONES", zonesJson },
      ])[0].flag,
    ).toBe("NORMAL");
    expect(
      enrichResultLines([
        { code: "VITD", value: "90", boundKind: "ZONES", zonesJson },
      ])[0].flag,
    ).toBe("HIGH");
  });

  it("does not flag or keep a norm when the value is a dash", () => {
    const [row] = enrichResultLines([
      { code: "U-PRO", value: "—", refMin: "0.0", refMax: "0.33", normTextAz: "0.0-0.33 g/l" },
    ]);
    expect(row.flag).toBeUndefined();
    expect(row.normTextAz).toBeUndefined();
    expect(row.refMin).toBeUndefined();
  });

  it("resolves shared bounds when sex pairs are absent", () => {
    expect(resolveNumericBounds({ refMin: "3.8", refMax: "6.4" }, "FEMALE")).toEqual({
      refMin: "3.8",
      refMax: "6.4",
    });
  });
});
