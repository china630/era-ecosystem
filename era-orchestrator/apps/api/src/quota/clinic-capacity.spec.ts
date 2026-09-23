import { describe, expect, it } from "@jest/globals";
import {
  clinicCapacityOverage,
  clinicRoomBillableModule,
  rewriteClinicActiveModules,
} from "@era365/database";
import { clinicBedOverageUnits, clinicRoomOverageUnits } from "./clinic-capacity";

describe("clinic capacity 5 included + 19 AZN", () => {
  it("5 rooms included, sixth is overage", () => {
    expect(clinicCapacityOverage(5)).toBe(0);
    expect(clinicCapacityOverage(6)).toBe(1);
    expect(clinicCapacityOverage(12)).toBe(7);
  });

  it("bills rooms on sanatorium when both EMR and sanatorium are on", () => {
    const mods = ["clinic_registry_emr", "clinic_sanatorium"];
    expect(clinicRoomBillableModule(mods)).toBe("clinic_sanatorium");
    expect(clinicRoomOverageUnits(8, mods)).toEqual({
      moduleKey: "clinic_sanatorium",
      overageUnits: 3,
    });
  });

  it("bills rooms on EMR when sanatorium is off", () => {
    expect(clinicRoomOverageUnits(6, ["clinic_registry_emr"])).toEqual({
      moduleKey: "clinic_registry_emr",
      overageUnits: 1,
    });
  });

  it("does not bill rooms without EMR or sanatorium", () => {
    expect(clinicRoomOverageUnits(20, ["industry_clinic", "clinic_lab"])).toEqual({
      moduleKey: null,
      overageUnits: 0,
    });
  });

  it("beds only when inpatient is on", () => {
    expect(clinicBedOverageUnits(10, ["clinic_sanatorium"])).toBe(0);
    expect(clinicBedOverageUnits(10, ["clinic_inpatient"])).toBe(5);
  });
});

describe("rewriteClinicActiveModules", () => {
  it("renames sanatorium key and drops retired zeros", () => {
    const next = rewriteClinicActiveModules([
      "industry_clinic",
      "clinic_sanatorium_clinical",
      "clinic_patients",
      "clinic_lis_import",
      "clinic_portal",
    ]);
    expect(next).toEqual(
      expect.arrayContaining([
        "industry_clinic",
        "clinic_sanatorium",
        "clinic_registry_emr",
        "clinic_lab",
      ]),
    );
    expect(next).not.toContain("clinic_sanatorium_clinical");
    expect(next).not.toContain("clinic_patients");
    expect(next).not.toContain("clinic_portal");
    expect(next).not.toContain("platform_portal");
    expect(next).not.toContain("platform_notifications");
  });
});
