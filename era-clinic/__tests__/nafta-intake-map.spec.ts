import {
  isNaftaIntakeGroupName,
  mapWoIntakeProcedureName,
  naftaIntakeVisitCodes,
  resolveNaftaIntakeCode,
} from "@/lib/import/nafta-intake-map";

describe("nafta-intake-map", () => {
  it("maps the canonical 4 WO procedure names", () => {
    expect(mapWoIntakeProcedureName("Həkim qəbulu")).toBe("VISIT-SANATORIUM-INTAKE");
    expect(mapWoIntakeProcedureName("Ginekoloq/Uroloq müayinəsi")).toBe("GYN-OR-URO");
    expect(mapWoIntakeProcedureName("EKQ və kardioloqun müayinəsi")).toBe("CARDIO-ECG");
    expect(mapWoIntakeProcedureName("Qarın boşluğu və kiçik çanaq tam USM")).toBe("USG-ABD");
  });

  it("recognizes İlkin diaqnostik group (İ fold)", () => {
    expect(isNaftaIntakeGroupName("İlkin diaqnostik prosedurlar (Check-up)")).toBe(true);
    expect(isNaftaIntakeGroupName("Check up starter")).toBe(false);
  });

  it("resolves GYN vs URO by sex", () => {
    expect(resolveNaftaIntakeCode("GYN-OR-URO", "FEMALE")).toBe("VISIT-GYN");
    expect(resolveNaftaIntakeCode("GYN-OR-URO", "MALE")).toBe("VISIT-URO");
    expect(resolveNaftaIntakeCode("GYN-OR-URO", "UNKNOWN")).toBe("GYN-OR-URO");
    expect(naftaIntakeVisitCodes("FEMALE")).toEqual(["VISIT-SANATORIUM-INTAKE", "VISIT-GYN"]);
    expect(naftaIntakeVisitCodes("MALE")).toEqual(["VISIT-SANATORIUM-INTAKE", "VISIT-URO"]);
    expect(naftaIntakeVisitCodes("UNKNOWN")).toEqual(["VISIT-SANATORIUM-INTAKE"]);
  });
});
