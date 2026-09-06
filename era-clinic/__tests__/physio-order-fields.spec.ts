import { PhysioCatalogError } from "@/domain/physio/physio-catalog";
import {
  parsePhysioOrderFields,
  sanitizePhysioFields,
  assertLateralityAllowed,
} from "@/domain/physio/physio-order-fields";
import { inferPhysioTypeGate } from "@/domain/physio/physio-type-gate";
import { matchProcedureToSeed } from "@/lib/import/seed-catalog-match";

describe("physio type-gated fields (CLI-49 W3)", () => {
  it("infers ozone: no site, no bath cadence fields", () => {
    expect(inferPhysioTypeGate("SVC-OZONTERAPIYA", "Ozonterapiya")).toEqual({
      needsSite: false,
      fields: [],
      allowedSiteCodes: [],
      forceSiteTogether: false,
      sitesHintKey: null,
    });
  });

  it("infers inhalation: no site, additive flags", () => {
    expect(inferPhysioTypeGate("SVC-INQALYASIYA", "İnqalyasiya")).toEqual({
      needsSite: false,
      fields: ["NO_ADDITIVE", "SUBSTANCE_OR_ADDITIVE"],
      allowedSiteCodes: [],
      forceSiteTogether: false,
      sitesHintKey: null,
    });
  });

  it("infers Amplipuls: work-kind + electrodes + WO program/surface fields", () => {
    const gate = inferPhysioTypeGate("SVC-AMPLIPULS", "Amplipuls");
    expect(gate.needsSite).toBe(true);
    expect(gate.fields).toEqual(
      expect.arrayContaining([
        "LATERALITY",
        "AMPLIPULS_WORK_KIND",
        "ELECTRODE_COUNT",
        "DEVICE_PROGRAM",
        "APPLICATION_SURFACE",
        "DEVICE_PARAMS",
        "SPINE_LEVEL",
      ]),
    );
    expect(gate.allowedSiteCodes).toContain("ZONE-KNEE");
    expect(gate.allowedSiteCodes).not.toContain("ZONE-FOUR-CHAMBER");
    expect(gate.allowedSiteCodes).not.toContain("ZONE-EAR");
  });

  it("infers electrophoresis-like electro: substance + program + electrodes + WO extras", () => {
    const gate = inferPhysioTypeGate("SVC-ELEKTROTERAPIYA", "Elektroterapiya");
    expect(gate.needsSite).toBe(true);
    expect(gate.fields).toEqual(
      expect.arrayContaining([
        "LATERALITY",
        "SUBSTANCE_OR_ADDITIVE",
        "ELECTRODE_COUNT",
        "DEVICE_PROGRAM",
        "SPINE_LEVEL",
        "DEVICE_PARAMS",
        "APPLICATION_SURFACE",
      ]),
    );
  });

  it("infers UFF: substance + extra oil + device params + surface", () => {
    const gate = inferPhysioTypeGate("SVC-ULTRAFONOFOREZ", "Ultrafonoforez");
    expect(gate.fields).toEqual(
      expect.arrayContaining([
        "SUBSTANCE_OR_ADDITIVE",
        "EXTRA_OIL",
        "DEVICE_PARAMS",
        "APPLICATION_SURFACE",
        "DEVICE_PROGRAM",
      ]),
    );
  });

  it("infers Solyuks (one l) like Sollyuks with naftalan oil fields", () => {
    const gate = inferPhysioTypeGate("WO-TR-129", "Solyuks");
    expect(gate.needsSite).toBe(true);
    expect(gate.fields).toEqual(
      expect.arrayContaining([
        "LATERALITY",
        "SUBSTANCE_OR_ADDITIVE",
        "EXTRA_OIL",
        "DEVICE_PROGRAM",
        "DEVICE_PARAMS",
        "APPLICATION_SURFACE",
      ]),
    );
  });

  it("infers naftalan immersion bath: sit/full + day block (no smear — use Aplikasiya SKU)", () => {
    const qadin = inferPhysioTypeGate("SVC-NAFTALAN-VANNASI-QADIN", "Naftalan vannası (Qadın)");
    expect(qadin.fields).toEqual(
      expect.arrayContaining(["NAFTALAN_FILL", "BATH_SEQUENCE", "DAY_BLOCK"]),
    );
    expect(qadin.fields).not.toContain("SMEAR");
    expect(qadin.fields).not.toContain("LATERALITY");
    expect(qadin.fields).not.toContain("DEVICE_PARAMS");
    expect(qadin.fields).not.toContain("DEVICE_PROGRAM");
    expect(qadin.fields).not.toContain("HOLD_OR_STOP");
    expect(
      inferPhysioTypeGate("SVC-4-KAMERALI-NAFTALAN-VANNASI", "4 kameralı naftalan vannası").fields,
    ).not.toContain("BATH_SEQUENCE");
    expect(
      inferPhysioTypeGate("SVC-4-KAMERALI-NAFTALAN-VANNASI", "4 kameralı naftalan vannası").fields,
    ).not.toContain("SMEAR");
    expect(
      inferPhysioTypeGate(
        "SVC-4-KAMERALI-HIDROQALVANIZASIYA",
        "4 kameralı hidroqalvanizasiya",
      ).fields,
    ).toContain("SUBSTANCE_OR_ADDITIVE");
  });

  it("infers Aplikasiya Naftalan ♀/♂: anatomical + substance + day block (shares bath cabins)", () => {
    for (const [code, name] of [
      ["SVC-APLIKASIYA-NAFTALAN-QADIN", "Aplikasiya Naftalan (Qadın)"],
      ["SVC-APLIKASIYA-NAFTALAN-KISI", "Aplikasiya Naftalan (Kişi)"],
    ] as const) {
      const gate = inferPhysioTypeGate(code, name);
      expect(gate.needsSite).toBe(true);
      expect(gate.fields).toEqual(
        expect.arrayContaining([
          "LATERALITY",
          "SUBSTANCE_OR_ADDITIVE",
          "APPLICATION_SURFACE",
          "DAY_BLOCK",
        ]),
      );
      expect(gate.fields).not.toContain("NAFTALAN_FILL");
      expect(gate.allowedSiteCodes).toContain("ZONE-FULL-BODY");
      expect(gate.allowedSiteCodes).toContain("ZONE-KNEE");
      expect(gate.allowedSiteCodes).not.toContain("ZONE-SITZ");
    }
  });

  it("maps WO short names via PROCEDURE_ALIASES", () => {
    const catalog = [
      { code: "SVC-HIDROKOLONOTERAPIYA", name: "Hidrokolonoterapiya" },
      { code: "SVC-TURUNDA-BURUN", name: "Turunda burun" },
      { code: "SVC-TURUNDA-QULAQ", name: "Turunda qulaq" },
      { code: "SVC-ISIQ-VANNASI", name: "İşıq vannası" },
      { code: "SVC-MANUAL-TERAPIYA", name: "Manual terapiya" },
      { code: "SVC-UROLOJI-MIKROKLIZMA", name: "Uroloji mikroklizma" },
      { code: "SVC-FITO-TERAPIYA-BOCKA", name: "Fito terapiya (boçka)" },
      { code: "SVC-PROLOTERAPIYA", name: "Proloterapiya" },
      { code: "SVC-APLIKASIYA-NAFTALAN-QADIN", name: "Aplikasiya Naftalan (Qadın)" },
      { code: "SVC-TRAKSIYA", name: "Traksiya" },
    ];
    expect(matchProcedureToSeed("Hidrokolon", catalog)?.code).toBe("SVC-HIDROKOLONOTERAPIYA");
    expect(matchProcedureToSeed("Turunda qulaq", catalog)?.code).toBe("SVC-TURUNDA-QULAQ");
    expect(matchProcedureToSeed("Turunda burun", catalog)?.code).toBe("SVC-TURUNDA-BURUN");
    expect(matchProcedureToSeed("Turunda (burun və qulaq)", catalog)?.code).toBe("SVC-TURUNDA-BURUN");
    expect(matchProcedureToSeed("Aplikasiya", catalog)?.code).toBe("SVC-APLIKASIYA-NAFTALAN-QADIN");
    expect(matchProcedureToSeed("Traksiya", catalog)?.code).toBe("SVC-TRAKSIYA");
    expect(matchProcedureToSeed("İşıq vannası", catalog)?.code).toBe("SVC-ISIQ-VANNASI");
    expect(matchProcedureToSeed("Manual Terapiya", catalog)?.code).toBe("SVC-MANUAL-TERAPIYA");
    expect(matchProcedureToSeed("Mikroklizma", catalog)?.code).toBe("SVC-UROLOJI-MIKROKLIZMA");
    expect(matchProcedureToSeed("Fitoterapiya ( boçka )", catalog)?.code).toBe("SVC-FITO-TERAPIYA-BOCKA");
    expect(matchProcedureToSeed("Proloterapiya2", catalog)?.code).toBe("SVC-PROLOTERAPIYA");
  });

  it("gates işıq as light cabin with anatomical sites + naftalan; gyn/prolo no site", () => {
    const isiq = inferPhysioTypeGate("SVC-ISIQ-VANNASI", "İşıq vannası");
    expect(isiq.needsSite).toBe(true);
    expect(isiq.allowedSiteCodes).toContain("ZONE-FULL-BODY");
    expect(isiq.allowedSiteCodes).toContain("ZONE-LOWER-LIMB");
    expect(isiq.fields).toEqual(
      expect.arrayContaining(["SUBSTANCE_OR_ADDITIVE", "EXTRA_OIL", "APPLICATION_SURFACE"]),
    );
    expect(inferPhysioTypeGate("SVC-GINEKOLOJI-TAMPON", "Ginekoloji tampon").needsSite).toBe(false);
    expect(inferPhysioTypeGate("SVC-PROLOTERAPIYA", "Proloterapiya").needsSite).toBe(false);
    expect(inferPhysioTypeGate("SVC-MANUAL-TERAPIYA", "Manual terapiya").fields).toContain("LATERALITY");
  });

  it("omits LATERALITY on baths, four-chamber, bükmə, paraffin bütün", () => {
    for (const [code, name] of [
      ["SVC-YOD-BROM-VANNASI", "Yod brom vannası"],
      ["SVC-HIDROMASAJ-VANNASI", "Hidromasaj vannası"],
      ["SVC-BUKME", "Bükmə"],
      ["SVC-4-KAMERALI-HIDROQALVANIZASIYA", "4 kameralı hidroqalvanizasiya"],
      ["SVC-4-KAMERALI-NAFTALAN-VANNASI", "4 kameralı naftalan vannası"],
      ["SVC-PARAFINOTERAPIYA-BUTUN-BEDEN", "Parafinoterapiya (bütün bədən)"],
    ] as const) {
      expect(inferPhysioTypeGate(code, name).fields).not.toContain("LATERALITY");
    }
    // Limb / joint SKUs still expose laterality on the order
    expect(inferPhysioTypeGate("SVC-AMPLIPULS", "Amplipuls").fields).toContain("LATERALITY");
    expect(
      inferPhysioTypeGate("SVC-PARAFINOTERAPIYA-ASAGI-ETRAF", "Parafinoterapiya (aşağı ətraf)")
        .fields,
    ).toContain("LATERALITY");
  });

  it("binds four-chamber SKUs only to ZONE-FOUR-CHAMBER", () => {
    const gate = inferPhysioTypeGate(
      "SVC-4-KAMERALI-HIDROQALVANIZASIYA",
      "4 kameralı hidroqalvanizasiya",
    );
    expect(gate.allowedSiteCodes).toEqual(["ZONE-FOUR-CHAMBER"]);
  });

  it("binds yod-brom to heart-sparing bath fills (not head)", () => {
    const gate = inferPhysioTypeGate("SVC-YOD-BROM-VANNASI", "Yod brom vannası");
    expect(gate.allowedSiteCodes).toEqual(["ZONE-FULL-BODY", "ZONE-TO-WAIST"]);
  });

  it("binds hidromasaj to immersion + jet-safety hint", () => {
    const gate = inferPhysioTypeGate("SVC-HIDROMASAJ-VANNASI", "Hidromasaj vannası");
    expect(gate.allowedSiteCodes).toEqual(["ZONE-FULL-BODY", "ZONE-TO-WAIST"]);
    expect(gate.sitesHintKey).toBe("hydro_jet_safety");
  });

  it("binds naftalan ♀/♂ to FULL + SITZ only", () => {
    expect(
      inferPhysioTypeGate("SVC-NAFTALAN-VANNASI-QADIN", "Naftalan vannası (Qadın)").allowedSiteCodes,
    ).toEqual(["ZONE-FULL-BODY", "ZONE-SITZ"]);
    expect(
      inferPhysioTypeGate("SVC-NAFTALAN-VANNASI-KISI", "Naftalan vannası (Kişi)").allowedSiteCodes,
    ).toEqual(["ZONE-FULL-BODY", "ZONE-SITZ"]);
  });

  it("binds amplipuls/electro/UFF without ear/scalp", () => {
    for (const [code, name] of [
      ["SVC-AMPLIPULS", "Amplipuls"],
      ["SVC-ELEKTROTERAPIYA", "Elektroterapiya"],
      ["SVC-ULTRAFONOFOREZ", "Ultrafonoforez"],
    ] as const) {
      const gate = inferPhysioTypeGate(code, name);
      expect(gate.allowedSiteCodes).not.toContain("ZONE-EAR");
      expect(gate.allowedSiteCodes).not.toContain("ZONE-SCALP");
      expect(gate.allowedSiteCodes).toContain("ZONE-KNEE");
    }
  });

  it("binds ESWT without cranial or FULL-BODY", () => {
    const gate = inferPhysioTypeGate("SVC-ZERBE-DALGA-TERAPIYA", "Zərbə dalğa terapiya");
    expect(gate.allowedSiteCodes).not.toContain("ZONE-HEAD");
    expect(gate.allowedSiteCodes).not.toContain("ZONE-FULL-BODY");
    expect(gate.allowedSiteCodes).toContain("ZONE-KNEE");
  });

  it("binds limfodrenaj to legs+abdomen with forceSiteTogether", () => {
    const gate = inferPhysioTypeGate("SVC-LIMFODRENAJ", "Limfodrenaj");
    expect(gate.allowedSiteCodes).toContain("ZONE-LOWER-LIMB");
    expect(gate.allowedSiteCodes).toContain("ZONE-ABDOMEN");
    expect(gate.forceSiteTogether).toBe(true);
  });

  it("binds paraffin aşağı to legs up to buttocks only", () => {
    const gate = inferPhysioTypeGate(
      "SVC-PARAFINOTERAPIYA-ASAGI-ETRAF",
      "Parafinoterapiya (aşağı ətraf)",
    );
    expect(gate.allowedSiteCodes).toContain("ZONE-HIP-GLUTEAL");
    expect(gate.allowedSiteCodes).not.toContain("ZONE-ABDOMEN");
  });

  it("binds split turunda SKUs to face/ear; combined name still face+ear via gate", () => {
    expect(inferPhysioTypeGate("SVC-TURUNDA-BURUN", "Turunda burun").allowedSiteCodes).toEqual([
      "ZONE-FACE",
    ]);
    expect(inferPhysioTypeGate("SVC-TURUNDA-QULAQ", "Turunda qulaq").allowedSiteCodes).toEqual([
      "ZONE-EAR",
    ]);
    expect(
      inferPhysioTypeGate("LEGACY", "Turunda (burun və qulaq)").allowedSiteCodes,
    ).toEqual(["ZONE-FACE", "ZONE-EAR"]);
  });

  it("omits DAY_BLOCK on paraffin/darsonval/SIS; keeps on naftalan family", () => {
    expect(
      inferPhysioTypeGate("SVC-PARAFINOTERAPIYA-ASAGI-ETRAF", "Parafinoterapiya (aşağı ətraf)")
        .fields,
    ).not.toContain("DAY_BLOCK");
    expect(inferPhysioTypeGate("SVC-DARSONVAL", "Darsonval").fields).not.toContain("DAY_BLOCK");
    expect(
      inferPhysioTypeGate(
        "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
        "Super Inductive system terapiyası",
      ).fields,
    ).not.toContain("DAY_BLOCK");
    expect(
      inferPhysioTypeGate("SVC-NAFTALAN-VANNASI-QADIN", "Naftalan vannası (Qadın)").fields,
    ).toContain("DAY_BLOCK");
    expect(
      inferPhysioTypeGate("SVC-APLIKASIYA-NAFTALAN-QADIN", "Aplikasiya Naftalan (Qadın)").fields,
    ).toContain("DAY_BLOCK");
  });

  it("infers Traksiya with anatomical sites", () => {
    const gate = inferPhysioTypeGate("SVC-TRAKSIYA", "Traksiya");
    expect(gate.needsSite).toBe(true);
    expect(gate.fields).toEqual(
      expect.arrayContaining(["LATERALITY", "INTENSITY", "HOLD_OR_STOP", "APPLICATION_SURFACE"]),
    );
  });

  it("binds bükmə (body wrap) to FULL-BODY only", () => {
    expect(inferPhysioTypeGate("SVC-BUKME", "Bükmə").allowedSiteCodes).toEqual(["ZONE-FULL-BODY"]);
  });

  it("rejects a field the procedure type does not allow (negative path)", () => {
    expect(() =>
      sanitizePhysioFields(
        ["AMPLIPULS_WORK_KIND", "ELECTRODE_COUNT"],
        { substanceId: "x" },
        {},
      ),
    ).toThrow(PhysioCatalogError);
    expect(() =>
      sanitizePhysioFields(["NO_ADDITIVE"], { amplipulsWorkKind: "IV" }, {}),
    ).toThrow(/AMPLIPULS_WORK_KIND/);
  });

  it("accepts allowed values and drops keys when the type no longer lists them", () => {
    const next = sanitizePhysioFields(
      ["AMPLIPULS_WORK_KIND", "ELECTRODE_COUNT"],
      { amplipulsWorkKind: "IV", electrodeCount: "4" },
      { noAdditive: true },
    );
    expect(next).toEqual({ amplipulsWorkKind: "IV", electrodeCount: "4" });
  });

  it("rejects laterality when the type or the site does not allow it", () => {
    expect(() =>
      assertLateralityAllowed([], [{ id: "s1", laterality: true }], { s1: "LEFT" }),
    ).toThrow(/LATERALITY/);
    expect(() =>
      assertLateralityAllowed(["LATERALITY"], [{ id: "s1", laterality: false }], { s1: "LEFT" }),
    ).toThrow(/not allowed on site/);
  });

  it("parses SatAdmin field list and rejects unknown codes", () => {
    expect(parsePhysioOrderFields(["laterality", "DEVICE_PROGRAM"])).toEqual([
      "LATERALITY",
      "DEVICE_PROGRAM",
    ]);
    expect(() => parsePhysioOrderFields(["NAHIYE"])).toThrow(/Unknown physio order field/);
  });
});
