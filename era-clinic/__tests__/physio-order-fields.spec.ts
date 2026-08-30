import { PhysioCatalogError } from "@/domain/physio/physio-catalog";
import {
  parsePhysioOrderFields,
  sanitizePhysioFields,
  assertLateralityAllowed,
} from "@/domain/physio/physio-order-fields";
import { inferPhysioTypeGate } from "@/domain/physio/physio-type-gate";

describe("physio type-gated fields (CLI-49 W3)", () => {
  it("infers ozone: no site, no extra fields", () => {
    expect(inferPhysioTypeGate("SVC-OZONTERAPIYA", "Ozonterapiya")).toEqual({
      needsSite: false,
      fields: [],
    });
  });

  it("infers inhalation: no site, additive flags", () => {
    expect(inferPhysioTypeGate("SVC-INQALYASIYA", "İnqalyasiya")).toEqual({
      needsSite: false,
      fields: ["NO_ADDITIVE", "SUBSTANCE_OR_ADDITIVE"],
    });
  });

  it("infers Amplipuls: work-kind + electrodes + laterality", () => {
    expect(inferPhysioTypeGate("SVC-AMPLIPULS", "Amplipuls")).toEqual({
      needsSite: true,
      fields: ["LATERALITY", "AMPLIPULS_WORK_KIND", "ELECTRODE_COUNT"],
    });
  });

  it("infers electrophoresis-like electro: substance + program + electrodes", () => {
    const gate = inferPhysioTypeGate("SVC-ELEKTROTERAPIYA", "Elektroterapiya");
    expect(gate.needsSite).toBe(true);
    expect(gate.fields).toEqual(
      expect.arrayContaining([
        "LATERALITY",
        "SUBSTANCE_OR_ADDITIVE",
        "ELECTRODE_COUNT",
        "DEVICE_PROGRAM",
      ]),
    );
  });

  it("infers UFF: substance + extra oil + device params", () => {
    const gate = inferPhysioTypeGate("SVC-ULTRAFONOFOREZ", "Ultrafonoforez");
    expect(gate.fields).toEqual(
      expect.arrayContaining(["SUBSTANCE_OR_ADDITIVE", "EXTRA_OIL", "DEVICE_PARAMS"]),
    );
  });

  it("infers Solyuks (one l) like Sollyuks", () => {
    const gate = inferPhysioTypeGate("WO-TR-129", "Solyuks");
    expect(gate.needsSite).toBe(true);
    expect(gate.fields).toEqual(
      expect.arrayContaining(["LATERALITY", "DEVICE_PROGRAM", "DEVICE_PARAMS", "APPLICATION_SURFACE"]),
    );
  });

  it("infers naftalan bath sequence but not four-chamber", () => {
    expect(inferPhysioTypeGate("SVC-TAM-BEDEN-NAFTALAN-VANNASI", "Tam bədən naftalan vannası").fields).toEqual(
      expect.arrayContaining(["BATH_SEQUENCE", "SMEAR", "NAFTALAN_FILL"]),
    );
    expect(
      inferPhysioTypeGate("SVC-4-KAMERALI-NAFTALAN-VANNASI", "4 kameralı naftalan vannası").fields,
    ).not.toContain("BATH_SEQUENCE");
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
