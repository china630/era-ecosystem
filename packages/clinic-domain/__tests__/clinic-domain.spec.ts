import {
  canAssignBed,
  patientHasMdmIdentifier,
  wardDayChargeReference,
} from "../src/index";

describe("@era/clinic-domain", () => {
  it("detects patient identifiers", () => {
    expect(patientHasMdmIdentifier({ finCode: "ABC1234" })).toBe(true);
    expect(patientHasMdmIdentifier({})).toBe(false);
  });

  it("guards bed assignment", () => {
    expect(canAssignBed("AVAILABLE", false)).toBe(true);
    expect(canAssignBed("OCCUPIED", false)).toBe(false);
  });

  it("builds ward charge reference", () => {
    expect(wardDayChargeReference("adm1", "2026-06-10")).toBe(
      "ward-day:adm1:2026-06-10",
    );
  });
});
