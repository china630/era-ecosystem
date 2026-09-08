import {
  applyCatalogMutex,
  bundleConflictsWithModules,
  HOTEL_SANATORIUM_BUNDLE_NAME,
  isClinicFeatureEntitled,
  isPassThroughCatalogModuleKeyExtended,
} from "@era365/database";
import { bundleDiscountedPriceAzn } from "../billing/billing-entitlement.util";

describe("pricing catalog freeze", () => {
  it("XOR data hub and loyalty vs retail promo", () => {
    expect(
      applyCatalogMutex(
        ["platform_reference_data", "platform_datahub_silver"],
        "platform_datahub_silver",
      ),
    ).toEqual(["platform_datahub_silver"]);
    expect(
      applyCatalogMutex(
        ["platform_loyalty", "retail_promotions"],
        "platform_loyalty",
      ).sort(),
    ).toEqual(["platform_loyalty"]);
  });

  it("keeps workforce hub alias with Base XOR PRO", () => {
    const base = applyCatalogMutex(["platform_workforce_base"], "platform_workforce_base");
    expect(base).toEqual(expect.arrayContaining(["platform_workforce", "platform_workforce_base"]));
    expect(base).not.toContain("platform_workforce_pro");
    const pro = applyCatalogMutex(
      ["platform_workforce_base", "platform_workforce_pro"],
      "platform_workforce_pro",
    );
    expect(pro).toContain("platform_workforce_pro");
    expect(pro).toContain("platform_workforce");
    expect(pro).not.toContain("platform_workforce_base");
  });

  it("grants EMR children from clinic_registry_emr", () => {
    const keys = applyCatalogMutex(["clinic_registry_emr"]);
    expect(keys).toEqual(
      expect.arrayContaining([
        "clinic_registry_emr",
        "clinic_patients",
        "clinic_visit",
        "clinic_ehr",
        "clinic_reschedule",
      ]),
    );
    expect(isClinicFeatureEntitled(keys, "clinic_patients")).toBe(true);
  });

  it("blocks Hotel Sanatorium bundle with clinic sanatorium SKU", () => {
    expect(
      bundleConflictsWithModules(
        HOTEL_SANATORIUM_BUNDLE_NAME,
        ["hotel_medical_sanatorium", "hotel_core"],
        ["clinic_sanatorium_clinical"],
      ),
    ).toBe(true);
  });

  it("prices Hotel Resort bundle at 188.70 AZN", () => {
    const priceByKey = new Map([
      ["hotel_core", 29],
      ["hotel_housekeeping", 19],
      ["hotel_migration_pro", 39],
      ["hotel_distribution", 29],
      ["hotel_guest_experience", 29],
      ["hotel_spa_scheduling", 29],
      ["hotel_banquets", 29],
      ["hotel_transfers", 19],
    ]);
    const keys = [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_migration_pro",
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_spa_scheduling",
      "hotel_banquets",
      "hotel_transfers",
    ];
    expect(bundleDiscountedPriceAzn(keys, 15, priceByKey)).toBe(188.7);
  });

  it("treats nas and fnb_* as pass-through catalog keys", () => {
    expect(isPassThroughCatalogModuleKeyExtended("nas")).toBe(true);
    expect(isPassThroughCatalogModuleKeyExtended("fnb_recipes_bom")).toBe(true);
    expect(isPassThroughCatalogModuleKeyExtended("consolidation_pro")).toBe(true);
  });
});
