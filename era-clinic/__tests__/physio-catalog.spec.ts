import {
  normalizePhysioAlias,
  parseAliasList,
  parseCoarse,
  parseSiteKind,
  PhysioCatalogError,
} from "@/domain/physio/physio-catalog";
import { mapPhysioListSeeds, mapPhysioZoneSeeds } from "@/domain/physio/physio-seed-map";
import { inactiveCatalogDenied } from "@/lib/master-data-gates";

describe("physio catalog (CLI-49 W1)", () => {
  it("folds aliases and drops blanks/duplicates", () => {
    expect(normalizePhysioAlias("  Tens   Proqrami  ")).toBe("tens proqrami");
    expect(parseAliasList(["TENS", "tens", "  ", "TENS le"])).toEqual(["tens", "tens le"]);
  });

  it("rejects unknown site kind and coarse codes", () => {
    expect(() => parseSiteKind("NOPE")).toThrow(PhysioCatalogError);
    expect(parseSiteKind("SHCHERBAK")).toBe("SHCHERBAK");
    expect(() => parseCoarse(["HEAD", "NOSE"])).toThrow(/coarse/i);
    expect(parseCoarse(["head", "NECK"])).toEqual(["HEAD", "NECK"]);
  });

  it("maps zones and keeps first owner of a colliding alias", () => {
    const { sites, skippedAliases } = mapPhysioZoneSeeds([
      {
        code: "ZONE-HEAD",
        kind: "USSR-817",
        titleAz: "Baş",
        titleRu: "Голова",
        titleEn: "Head",
        titleLa: "Caput",
        coarse: ["HEAD"],
        woAliases: ["bas", "baş"],
      },
      {
        code: "ZONE-FACE",
        kind: "USSR-817",
        titleAz: "Üz",
        titleRu: "Лицо",
        titleEn: "Face",
        titleLa: "Facies",
        coarse: ["HEAD"],
        woAliases: ["bas", "uz"],
      },
    ]);
    expect(sites[0].aliases).toEqual(["bas", "baş"]);
    expect(sites[1].aliases).toEqual(["uz"]);
    expect(skippedAliases).toEqual([{ alias: "bas", fromCode: "ZONE-FACE", keptCode: "ZONE-HEAD" }]);
  });

  it("maps list items without crossing DEVICE_PROGRAM vs SUBSTANCE alias namespaces", () => {
    const rows = mapPhysioListSeeds([
      {
        listKind: "DEVICE_PROGRAM",
        code: "TENS",
        titleAz: "TENS",
        titleRu: "TENS",
        titleEn: "TENS",
        aliases: ["tens"],
      },
      {
        listKind: "SUBSTANCE",
        code: "NAFTALAN",
        titleAz: "Naftalan",
        titleRu: "Нафталан",
        titleEn: "Naftalan",
        aliases: ["tens", "naft"],
      },
    ]);
    expect(rows[0].aliases).toEqual(["tens"]);
    expect(rows[1].aliases).toEqual(["tens", "naft"]);
  });

  it("retire is the inactive catalog gate (no hard delete)", () => {
    expect(inactiveCatalogDenied(false, "Physio site")).toMatch(/inactive/i);
    expect(inactiveCatalogDenied(true, "Physio site")).toBeNull();
  });
});
