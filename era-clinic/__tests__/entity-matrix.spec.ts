import { ALL_CLINIC_PERMISSIONS, ENTITY_ACCESS_MATRIX, expandClinicCatalog, CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";

describe("clinic entity access matrix", () => {
  it("lists every catalog key exactly once", () => {
    const seen = ENTITY_ACCESS_MATRIX.flatMap((row) => Object.values(row.cells).flat());
    expect(seen.slice().sort()).toEqual([...ALL_CLINIC_PERMISSIONS].sort());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("copies read keys once and splits settings and master data", () => {
    const next = expandClinicCatalog([
      "screen:admin.master_data",
      CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
      CLINIC_PERMISSION.API_PATIENTS,
      CLINIC_PERMISSION.API_CASHIER,
      CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
    ]);
    expect(next).not.toContain("screen:admin.master_data" as never);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_PRACTITIONERS);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_ROOMS);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_WORKING_HOURS);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_WORKFORCE);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_OPS_WIPE);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS);
    expect(next).toContain(CLINIC_PERMISSION.API_PATIENTS_READ);
    expect(next).toContain(CLINIC_PERMISSION.API_FISCAL);
    expect(next).toContain(CLINIC_PERMISSION.API_BILLING_READ);
    expect(next).toContain(CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE);
    expect(expandClinicCatalog(next)).toEqual(next);
  });

  it("does not refill an empty grant list", () => {
    expect(expandClinicCatalog([])).toEqual([]);
  });
});
