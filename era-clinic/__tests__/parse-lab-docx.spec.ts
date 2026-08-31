const {
  parseValueUnit,
  resultsFromTableRows,
  isJunkResultLabel,
  panelFromName,
} = require("../scripts/nafta-cutover/parse-lab-docx.cjs");
const { eraAnalyteCode } = require("../scripts/nafta-cutover/wo-era-lab-map.cjs");

describe("parse-lab-docx urine template", () => {
  it("keeps decimals and ranges in the value cell", () => {
    expect(parseValueUnit("1.030")).toEqual({ value: "1.030", unit: "" });
    expect(parseValueUnit("6.0")).toEqual({ value: "6.0", unit: "" });
    expect(parseValueUnit("14-15")).toEqual({ value: "14-15", unit: "" });
    expect(parseValueUnit("++")).toEqual({ value: "++", unit: "" });
    expect(parseValueUnit("6.7 10^9/L")).toEqual({ value: "6.7", unit: "10^9/L" });
    expect(parseValueUnit("29.08.2026")).toEqual({ value: "", unit: "" });
  });

  it("drops Tarix header rows and U-DATE aliases", () => {
    expect(isJunkResultLabel("Sidiyin ümumi analizi Tarix:")).toBe(true);
    expect(eraAnalyteCode("SIDIYIN_MUMIANALIZITARIX")).not.toBe("U-DATE");
    const rows = resultsFromTableRows([
      ["Sidiyin ümumi analizi Tarix:", "30.08.2026"],
      ["№", "Parametr", "Nəticə", "Norma"],
      ["1", "Miqdarı", "50.0", ""],
      ["2", "Rəngi", "Açıq rəngli", ""],
      ["3", "Xüsusi çəki", "1.030", "1.005-1.030"],
      ["4", "PH", "6.0", "5.0-8.0"],
      ["Fiziki-kimyəvi xüsusiyyətləri"],
      ["7", "Leykositlər", "6-7", "0-5"],
      ["8", "Qlukoza", "++", ""],
    ]);
    expect(rows.map((r) => r.code)).not.toContain("U-DATE");
    expect(rows.find((r) => r.label === "Xüsusi çəki")).toMatchObject({ value: "1.030", unit: "" });
    expect(
      resultsFromTableRows([
        ["1", "Xüsusi çəki", "1030", ""],
        ["2", "PH", "6.0", ""],
        ["3", "Protein", "0.0", ""],
      ]).find((r) => r.code === "U-SG"),
    ).toMatchObject({ value: "1.030" });
    expect(rows.find((r) => r.label === "PH")).toMatchObject({ value: "6.0", code: "U-PH" });
    expect(rows.find((r) => r.label === "Leykositlər")).toMatchObject({ value: "6-7" });
    expect(rows.find((r) => r.label === "Qlukoza")).toMatchObject({ value: "++" });
    expect(rows).toHaveLength(6);
  });

  it("starts QAN/BIOKIM at row №=1 and keeps 4-col mapping", () => {
    const rows = resultsFromTableRows([
      ["Patient", "Elena"],
      ["№", "Parametr", "Nəticə", "Norma"],
      ["1", "WBC", "6.7", "4-10"],
      ["2", "RBC", "4.5", "4-5.5"],
      ["3", "HGB", "130", "120-160"],
    ]);
    expect(rows[0]).toMatchObject({ code: "WBC", value: "6.7" });
    expect(rows).toHaveLength(3);
  });

  it("maps SIDIK file names to urine panel", () => {
    expect(panelFromName("123_SIDIK.docx")).toBe("SIDIK");
    expect(panelFromName("57_QAN.docx")).toBe("QAN");
  });
});
