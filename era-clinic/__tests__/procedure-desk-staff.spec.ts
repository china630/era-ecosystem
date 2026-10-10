import {
  isHandsOnProcedureCode,
  isProcedureDeskStaff,
} from "@/domain/procedure/procedure-desk-staff";

describe("procedure desk staff", () => {
  it("treats visit codes as doctor visits and everything else as hands-on", () => {
    expect(isHandsOnProcedureCode("VISIT-CARD")).toBe(false);
    expect(isHandsOnProcedureCode(" visit-ent ")).toBe(false);
    expect(isHandsOnProcedureCode("SVC-COSM")).toBe(true);
    expect(isHandsOnProcedureCode("BATH-NAFT")).toBe(true);
    expect(isHandsOnProcedureCode("")).toBe(false);
  });

  it("keeps nurses, bath, and massage, and only procedure-performing doctors", () => {
    expect(isProcedureDeskStaff({ staffKind: "NURSE" })).toBe(true);
    expect(isProcedureDeskStaff({ staffKind: "BATH" })).toBe(true);
    expect(isProcedureDeskStaff({ staffKind: "MASSAGE" })).toBe(true);
    expect(isProcedureDeskStaff({ staffKind: "LAB" })).toBe(false);
    expect(
      isProcedureDeskStaff({ staffKind: "DOCTOR", procedureCodes: ["VISIT-CARD"] }),
    ).toBe(false);
    expect(
      isProcedureDeskStaff({
        staffKind: "DOCTOR",
        procedureCodes: ["VISIT-CARD", "SVC-COSM"],
      }),
    ).toBe(true);
    expect(isProcedureDeskStaff({ staffKind: "DOCTOR", procedureCodes: [] })).toBe(false);
  });
});
