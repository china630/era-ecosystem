import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  matchProcedureToSeed,
  matchRoomToSeed,
  normalizeCatalogName,
  type CatalogNameRow,
} from "@/lib/import/seed-catalog-match";

const procs = JSON.parse(
  readFileSync(join(process.cwd(), "prisma/seed-data/nafta/procedure-types.json"), "utf8"),
) as CatalogNameRow[];
const catalog = JSON.parse(
  readFileSync(join(process.cwd(), "prisma/seed-data/nafta/catalog.json"), "utf8"),
) as CatalogNameRow[];
const cabs = JSON.parse(
  readFileSync(join(process.cwd(), "prisma/seed-data/nafta/cabinets.json"), "utf8"),
) as CatalogNameRow[];

describe("seed-catalog-match", () => {
  it("maps WO names onto SVC seed codes", () => {
    expect(matchProcedureToSeed("Amplipuls", procs)?.code).toBe("SVC-AMPLIPULS");
    expect(matchProcedureToSeed("Solyuks", procs)?.code).toBe("SVC-SOLLYUKS");
    expect(matchProcedureToSeed("Elektroforez", procs)?.code).toBe("SVC-ELEKTROTERAPIYA");
    expect(matchProcedureToSeed("Naftalan vannası (Kişi)", procs)?.code).toBe(
      "SVC-NAFTALAN-VANNASI-KISI",
    );
    expect(matchProcedureToSeed("WO-TR-10", procs)).toBeNull();
    expect(catalog.some((row) => row.code === "SVC-SOLYUKS")).toBe(false);
    expect(catalog.some((row) => row.code === "SVC-SOLLYUKS")).toBe(true);
    const randevu = JSON.parse(
      readFileSync(join(process.cwd(), "prisma/seed-data/nafta/randevu-procedure-map.json"), "utf8"),
    ) as Record<string, string>;
    expect(randevu.Solyuks).toBe("SVC-SOLLYUKS");
  });

  it("maps WO cabinet names onto CAB seed codes", () => {
    expect(matchRoomToSeed("Kabina 7", cabs)?.code).toBe("CAB-KABINA-7");
    expect(matchRoomToSeed("Kabina 5 (Düz)", cabs)?.code).toBe("CAB-KABINA-5-DUZ");
    expect(normalizeCatalogName("Naftalan vannası")).toContain("naftalan");
  });
});
