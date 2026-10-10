import { readFileSync } from "node:fs";
import { join } from "node:path";

type CatalogAnalyte = { code?: string };
type Catalog = { labPanels?: Array<{ analytes?: CatalogAnalyte[] }> };
type Dictionary = { items?: Array<{ code?: string; label?: { en?: string; ru?: string; az?: string } }> };

describe("analyte dictionary seed", () => {
  const root = join(__dirname, "..", "prisma", "seed-data");
  const catalog = JSON.parse(
    readFileSync(join(root, "diagnostic-lab-catalog.json"), "utf8"),
  ) as Catalog;
  const dictionary = JSON.parse(
    readFileSync(join(root, "analyte-dictionary.json"), "utf8"),
  ) as Dictionary;

  it("covers every lab-panel analyte code exactly once", () => {
    const panelCodes = new Set<string>();
    for (const panel of catalog.labPanels ?? []) {
      for (const analyte of panel.analytes ?? []) {
        if (analyte.code) panelCodes.add(analyte.code);
      }
    }
    const dictCodes = (dictionary.items ?? []).map((row) => row.code);
    expect(new Set(dictCodes).size).toBe(dictCodes.length);
    expect(new Set(dictCodes)).toEqual(panelCodes);
    expect(dictCodes.length).toBeGreaterThan(200);
  });

  it("keeps a label in each language", () => {
    for (const row of dictionary.items ?? []) {
      expect(row.label?.en).toBeTruthy();
      expect(row.label?.ru).toBeTruthy();
      expect(row.label?.az).toBeTruthy();
    }
  });
});
