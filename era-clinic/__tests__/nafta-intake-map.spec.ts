import {
  isNaftaIntakeGroupName,
  mapWoIntakeProcedureName,
  naftaIntakeVisitCodes,
  resolveNaftaIntakeCode,
} from "@/lib/import/nafta-intake-map";

describe("nafta-intake-map", () => {
  it("maps the canonical 4 WO procedure names", () => {
    expect(mapWoIntakeProcedureName("Həkim qəbulu")).toBe("SANATORIUM-INTAKE");
    expect(mapWoIntakeProcedureName("Ginekoloq/Uroloq müayinəsi")).toBe("GYN-OR-URO");
    expect(mapWoIntakeProcedureName("EKQ və kardioloqun müayinəsi")).toBe("ECG-12");
    expect(mapWoIntakeProcedureName("Qarın boşluğu və kiçik çanaq tam USM")).toBe("USG-ABD");
  });

  it("recognizes İlkin diaqnostik group (İ fold)", () => {
    expect(isNaftaIntakeGroupName("İlkin diaqnostik prosedurlar (Check-up)")).toBe(true);
    expect(isNaftaIntakeGroupName("Check up starter")).toBe(false);
  });

  it("resolves GYN vs URO by sex", () => {
    expect(resolveNaftaIntakeCode("GYN-OR-URO", "FEMALE")).toBe("GYN-VISIT");
    expect(resolveNaftaIntakeCode("GYN-OR-URO", "MALE")).toBe("URO-VISIT");
    expect(resolveNaftaIntakeCode("GYN-OR-URO", "UNKNOWN")).toBe("GYN-OR-URO");
    expect(naftaIntakeVisitCodes("FEMALE")).toEqual(["SANATORIUM-INTAKE", "GYN-VISIT"]);
    expect(naftaIntakeVisitCodes("MALE")).toEqual(["SANATORIUM-INTAKE", "URO-VISIT"]);
    expect(naftaIntakeVisitCodes("UNKNOWN")).toEqual(["SANATORIUM-INTAKE"]);
  });
});
