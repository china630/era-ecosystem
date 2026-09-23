import {
  applyCatalogMutex,
  isClinicFeatureEntitled,
  isPassThroughCatalogModuleKeyExtended,
} from "@era365/database";
import { bundleDiscountedPriceAzn } from "../billing/billing-entitlement.util";

describe("pricing catalog freeze", () => {
  it("XOR platform_domain host vs org pack", () => {
    expect(
      applyCatalogMutex(
        ["platform_domain", "platform_domain_org"],
        "platform_domain_org",
      ),
    ).toEqual(["platform_domain_org"]);
    expect(
      applyCatalogMutex(
        ["platform_domain", "platform_domain_org"],
        "platform_domain",
      ),
    ).toEqual(["platform_domain"]);
  });

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

  it("keeps EMR as a single commercial key without retired children", () => {
    const keys = applyCatalogMutex(["clinic_registry_emr"]);
    expect(keys).toEqual(["clinic_registry_emr"]);
    expect(isClinicFeatureEntitled(keys, "clinic_patients")).toBe(false);
    expect(isClinicFeatureEntitled(keys, "clinic_registry_emr")).toBe(true);
  });

  it("does not treat inpatient beds as sanatorium entitlement", () => {
    expect(isClinicFeatureEntitled(["clinic_inpatient"], "clinic_sanatorium")).toBe(
      false,
    );
    expect(applyCatalogMutex(["clinic_inpatient"])).toEqual(["clinic_inpatient"]);
  });

  it("keeps hotel medical and clinic sanatorium together", () => {
    const keys = applyCatalogMutex([
      "hotel_medical_sanatorium",
      "clinic_sanatorium",
      "hotel_core",
    ]);
    expect(keys).toEqual(
      expect.arrayContaining([
        "hotel_medical_sanatorium",
        "clinic_sanatorium",
        "hotel_core",
      ]),
    );
  });

  it("prices Hotel City bundle at 113.40 AZN", () => {
    const priceByKey = new Map([
      ["hotel_core", 29],
      ["hotel_housekeeping", 19],
      ["hotel_migration_pro", 39],
      ["hotel_distribution", 39],
    ]);
    const keys = [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_migration_pro",
      "hotel_distribution",
    ];
    expect(bundleDiscountedPriceAzn(keys, 10, priceByKey)).toBe(113.4);
  });

  it("prices Hotel Resort bundle at 197.20 AZN", () => {
    const priceByKey = new Map([
      ["hotel_core", 29],
      ["hotel_housekeeping", 19],
      ["hotel_migration_pro", 39],
      ["hotel_distribution", 39],
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
    expect(bundleDiscountedPriceAzn(keys, 15, priceByKey)).toBe(197.2);
  });

  it("prices Hotel Sanatorium bundle at 238.48 AZN", () => {
    const priceByKey = new Map([
      ["hotel_core", 29],
      ["hotel_housekeeping", 19],
      ["hotel_migration_pro", 39],
      ["hotel_distribution", 39],
      ["hotel_guest_experience", 29],
      ["hotel_spa_scheduling", 29],
      ["hotel_banquets", 29],
      ["hotel_transfers", 19],
      ["hotel_medical_sanatorium", 39],
    ]);
    const keys = [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_migration_pro",
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_transfers",
      "hotel_banquets",
      "hotel_spa_scheduling",
      "hotel_medical_sanatorium",
    ];
    expect(bundleDiscountedPriceAzn(keys, 12, priceByKey)).toBe(238.48);
  });

  it("treats nas and fnb_* as pass-through catalog keys", () => {
    expect(isPassThroughCatalogModuleKeyExtended("nas")).toBe(true);
    expect(isPassThroughCatalogModuleKeyExtended("fnb_recipes_bom")).toBe(true);
    expect(isPassThroughCatalogModuleKeyExtended("consolidation_pro")).toBe(true);
  });
});
