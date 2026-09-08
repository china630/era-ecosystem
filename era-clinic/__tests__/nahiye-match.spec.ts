import { join } from "node:path";
import {
  buildMatcher,
  bucketOf,
  classifyEmptyNahiye,
  fillImportedNote,
  overlayZoneAliases,
  resolveEmptyImportSiteCodes,
  type NahiyeMatchCatalog,
} from "@/domain/physio/nahiye-match";
import {
  defaultLateralityForSite,
  inferLateralityFromText,
  physioFieldsFromFlags,
  siteApplyModeFromFlags,
} from "@/domain/physio/nahiye-match-values";
import { loadMergedPhysioZonesCatalog } from "@/domain/physio/physio-catalog-layers";

const cjs = require("../scripts/nafta-cutover/nahiye-s-match.cjs") as {
  buildMatcher: (cat: NahiyeMatchCatalog) => {
    match: (text: string, opts?: { procedureName?: string }) => {
      chips: string[];
      flags: string[];
      residue: string;
      via: string;
    };
  };
};

const cat = loadMergedPhysioZonesCatalog(join(__dirname, "..")) as NahiyeMatchCatalog;

describe("nahiye matcher (CLI-49 W4)", () => {
  const tsMatcher = buildMatcher(cat);
  const cjsMatcher = cjs.buildMatcher(cat);

  it("matches every compositeMap identically in TS and CJS", () => {
    const rows = cat.compositeMaps ?? [];
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(tsMatcher.match(row.wo)).toEqual(cjsMatcher.match(row.wo));
    }
  });

  it("resolves bütün SKU-aware the same in TS and CJS", () => {
    const cases: Array<{ text: string; procedureName: string }> = [
      { text: "bütün", procedureName: "İnqalyasiya" },
      { text: "bütün", procedureName: "Massaj 30 dəq" },
      { text: "bütün", procedureName: "Amplipuls" },
      { text: "boyun bütün", procedureName: "UFB terapiya" },
    ];
    for (const c of cases) {
      expect(tsMatcher.match(c.text, { procedureName: c.procedureName })).toEqual(
        cjsMatcher.match(c.text, { procedureName: c.procedureName }),
      );
    }
  });

  it("does not treat substring as a whole-word site (TS = CJS)", () => {
    const raw = "barmaq";
    expect(tsMatcher.match(raw)).toEqual(cjsMatcher.match(raw));
    expect(tsMatcher.match(raw).chips).not.toContain("ZONE-HEAD");
  });

  it("never wipes an existing ProcedureOrder.note", () => {
    expect(fillImportedNote("doctor comment", "boyun")).toBe("doctor comment");
    expect(fillImportedNote("  keep  ", "")).toBe("  keep  ");
    expect(fillImportedNote(null, "boyun nahiyəsi")).toBe("boyun nahiyəsi");
    expect(fillImportedNote("", "  ")).toBeNull();
  });

  it("classifies empty ozone nahiye as no-surface-site", () => {
    expect(classifyEmptyNahiye("Ozonterapiya")).toEqual({
      kind: "no-surface-site",
      defaults: [],
    });
    expect(classifyEmptyNahiye("İnqalyasiya")).toEqual({
      kind: "no-surface-site",
      defaults: [],
    });
    expect(classifyEmptyNahiye("Massaj 30 dəq").defaults).toEqual(["ZONE-FULL-BODY"]);
    expect(classifyEmptyNahiye("Massaj 15 dəq").defaults).toEqual(["ZONE-FULL-BODY"]);
    expect(classifyEmptyNahiye("Naftalan vannası (Qadın)").defaults).toEqual(["ZONE-FULL-BODY"]);
    expect(classifyEmptyNahiye("Parafinoterapiya (aşağı ətraf)").defaults).toEqual(["ZONE-LOWER-LIMB"]);
  });

  it("resolves empty import sites: SKU named > FULL allowlist > single code", () => {
    expect(
      resolveEmptyImportSiteCodes("Parafinoterapiya (aşağı ətraf)", [
        "ZONE-LOWER-LIMB",
        "ZONE-KNEE",
        "ZONE-FULL-BODY",
      ]),
    ).toEqual(["ZONE-LOWER-LIMB"]);
    expect(resolveEmptyImportSiteCodes("Amplipuls", ["ZONE-KNEE", "ZONE-FULL-BODY", "ZONE-BACK"])).toEqual([
      "ZONE-FULL-BODY",
    ]);
    expect(resolveEmptyImportSiteCodes("Zərbə dalğa", ["ZONE-KNEE", "ZONE-SHOULDER"])).toEqual([]);
    expect(resolveEmptyImportSiteCodes("4 kameralı hidroqalvanizasiya", ["ZONE-FOUR-CHAMBER"])).toEqual([
      "ZONE-FOUR-CHAMBER",
    ]);
    expect(resolveEmptyImportSiteCodes("Ozonterapiya", [])).toEqual([]);
  });

  it("infers laterality and defaults BOTH when side omitted", () => {
    expect(inferLateralityFromText("sol diz")).toBe("LEFT");
    expect(inferLateralityFromText("sağ çiyin")).toBe("RIGHT");
    expect(inferLateralityFromText("hər iki ayaq")).toBe("BOTH");
    expect(inferLateralityFromText("diz")).toBeNull();
    expect(defaultLateralityForSite(true, null)).toBe("BOTH");
    expect(defaultLateralityForSite(true, "LEFT")).toBe("LEFT");
    expect(defaultLateralityForSite(false, null)).toBeNull();
    expect(siteApplyModeFromFlags(["SEQUENCE_ALTERNATING"])).toBe("TURN");
    expect(siteApplyModeFromFlags(["SEQUENCE_SIMULTANEOUS"])).toBe("TOGETHER");
  });

  it("overlays DB aliases onto JSON zones without dropping seed aliases", () => {
    const over = overlayZoneAliases(
      { zones: [{ code: "ZONE-COLLAR", woAliases: ["boyun"] }, { code: "ZONE-KNEE", woAliases: ["diz"] }] },
      [{ code: "ZONE-COLLAR", aliases: [{ alias: "sheya" }] }],
    );
    const collar = over.zones?.find((z) => z.code === "ZONE-COLLAR");
    expect(collar?.woAliases).toEqual(expect.arrayContaining(["boyun", "sheya"]));
    expect(over.zones?.some((z) => z.code === "ZONE-KNEE")).toBe(true);
  });

  it("matches Belinə / Başına / Tam to S codes", () => {
    expect(tsMatcher.match("Belinə").chips).toContain("ZONE-LUMBOSACRAL");
    expect(tsMatcher.match("Başına").chips).toContain("ZONE-HEAD");
    expect(tsMatcher.match("Tam").chips).toContain("ZONE-FULL-BODY");
    expect(tsMatcher.match("oturaq").chips).toContain("ZONE-SITZ");
  });

  it("sets NAFTALAN_FILL for bare tam/oturaq but not for sitz-then-full sequence", () => {
    expect(physioFieldsFromFlags([], "Tam", []).naftalanFill).toBe("TAM");
    expect(physioFieldsFromFlags([], "oturaq", []).naftalanFill).toBe("OTURAQ");
    expect(physioFieldsFromFlags(["BATH_SEQUENCE"], "1 ci oturaq son tam", []).naftalanFill).toBeUndefined();
    expect(physioFieldsFromFlags(["BATH_SEQUENCE"], "1 ci oturaq son tam", []).bathSequence).toBe(
      "SITZ_THEN_FULL",
    );
  });

  it("buckets mapped vs unknown the same in TS and CJS", () => {
    expect(bucketOf(tsMatcher.match("boyun"))).toBe(bucketOf(cjsMatcher.match("boyun")));
    expect(bucketOf(tsMatcher.match("zzzz-not-a-zone"))).toBe("unknown");
    expect(bucketOf(cjsMatcher.match("zzzz-not-a-zone"))).toBe("unknown");
  });
});
