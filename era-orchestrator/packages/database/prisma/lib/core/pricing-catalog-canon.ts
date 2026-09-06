/**
 * Commercial catalog freeze (2026-09): palette 19/29/39/99 AZN, XOR mutex,
 * commercial clinic SKUs, capacity meters. Entitlement + seed share this file.
 */

export const CATALOG_PALETTE_AZN = [19, 29, 39, 99] as const;

export const HOTEL_SANATORIUM_BUNDLE_NAME = "Hotel Sanatorium";

export const DATA_HUB_XOR = [
  "platform_reference_data",
  "platform_datahub_silver",
  "platform_datahub_gold",
] as const;

export const WORKFORCE_XOR = [
  "platform_workforce_base",
  "platform_workforce_pro",
] as const;

export const WORKFORCE_HUB_KEYS = [
  "platform_workforce",
  "platform_workforce_base",
  "platform_workforce_pro",
] as const;

export const CATALOG_MUTEX_GROUPS: readonly (readonly string[])[] = [
  DATA_HUB_XOR,
  WORKFORCE_XOR,
  ["platform_loyalty", "retail_promotions"],
  ["platform_delivery", "fnb_delivery_hub"],
  ["hotel_medical_sanatorium", "clinic_sanatorium_clinical"],
];

/** Child feature keys granted when a commercial parent SKU is on (price 0). */
export const CLINIC_COMMERCIAL_GRANTS: Readonly<Record<string, readonly string[]>> = {
  clinic_registry_emr: [
    "clinic_patients",
    "clinic_visit",
    "clinic_ehr",
    "clinic_reschedule",
  ],
  clinic_lab: ["clinic_lis_import"],
};

/** Feature key → commercial parents that also entitle it. */
export const CLINIC_FEATURE_PARENTS: Readonly<Record<string, readonly string[]>> = {
  clinic_patients: ["clinic_registry_emr"],
  clinic_visit: ["clinic_registry_emr"],
  clinic_ehr: ["clinic_registry_emr"],
  clinic_reschedule: ["clinic_registry_emr"],
  clinic_lis_import: ["clinic_lab"],
};

export const CLINIC_COMMERCIAL_MODULE_KEYS = [
  "clinic_nurse_roster",
  "clinic_registry_emr",
  "clinic_sanatorium_clinical",
] as const;

export const INDUSTRY_SUBMODULE_PREFIX_TO_GATE: Readonly<Record<string, string>> = {
  hotel_: "industry_hotel_pms",
  clinic_: "industry_clinic",
  banking_: "industry_banking",
  fnb_: "industry_fnb_pos",
  retail_: "industry_retail",
  auto_: "industry_auto_service",
  logistics_: "industry_logistics",
  construction_: "industry_construction",
  wholesale_: "industry_wholesale",
  crm_: "industry_crm",
};

export const PASS_THROUGH_CATALOG_KEYS = [
  "nas",
  "fixed_assets",
  "consolidation_pro",
] as const;

export type CapacityDriverDef = {
  satelliteKey: string;
  includedInGate: number;
  unitAzn: number;
  unit: string;
};

export const CAPACITY_DRIVERS: readonly CapacityDriverDef[] = [
  { satelliteKey: "industry_hotel_pms", includedInGate: 5, unitAzn: 4, unit: "room" },
  { satelliteKey: "industry_clinic", includedInGate: 1, unitAzn: 19, unit: "cabinet" },
  { satelliteKey: "industry_fnb_pos", includedInGate: 1, unitAzn: 19, unit: "pos" },
  { satelliteKey: "industry_retail", includedInGate: 1, unitAzn: 19, unit: "register" },
  { satelliteKey: "industry_auto_service", includedInGate: 1, unitAzn: 19, unit: "bay" },
  { satelliteKey: "industry_logistics", includedInGate: 2, unitAzn: 5, unit: "vehicle" },
  { satelliteKey: "industry_construction", includedInGate: 1, unitAzn: 29, unit: "site" },
  { satelliteKey: "industry_wholesale", includedInGate: 1, unitAzn: 19, unit: "warehouse" },
  { satelliteKey: "industry_crm", includedInGate: 1, unitAzn: 5, unit: "seat" },
  { satelliteKey: "industry_banking", includedInGate: 1, unitAzn: 39, unit: "branch" },
];

export const OUTLET_OVERAGE_AZN = 19;

export function isWorkforceHubKey(key: string): boolean {
  return (WORKFORCE_HUB_KEYS as readonly string[]).includes(key);
}

export function inferSatelliteKeyFromModuleKey(key: string): string | null {
  for (const [prefix, gate] of Object.entries(INDUSTRY_SUBMODULE_PREFIX_TO_GATE)) {
    if (key.startsWith(prefix)) return gate;
  }
  return null;
}

export function isPassThroughCatalogModuleKeyExtended(moduleKey: string): boolean {
  if ((PASS_THROUGH_CATALOG_KEYS as readonly string[]).includes(moduleKey)) return true;
  for (const prefix of Object.keys(INDUSTRY_SUBMODULE_PREFIX_TO_GATE)) {
    if (moduleKey.startsWith(prefix)) return true;
  }
  return moduleKey.startsWith("industry_") || moduleKey.startsWith("platform_");
}

export function isClinicFeatureEntitled(
  activeModules: readonly string[],
  moduleKey: string,
): boolean {
  const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
  if (set.has(moduleKey)) return true;
  for (const parent of CLINIC_FEATURE_PARENTS[moduleKey] ?? []) {
    if (set.has(parent)) return true;
  }
  if (moduleKey === "clinic_sanatorium_clinical" && set.has("clinic_inpatient")) {
    return true;
  }
  return false;
}

/**
 * Keep at most one SKU per XOR group. `prefer` wins when present in the group
 * (the slug just enabled). Workforce hub alias: Base/PRO keep `platform_workforce`.
 */
export function applyCatalogMutex(modules: readonly string[], prefer?: string): string[] {
  const set = new Set(modules.map((m) => m.trim()).filter(Boolean));

  for (const group of CATALOG_MUTEX_GROUPS) {
    const hits: string[] = [];
    for (const k of group) {
      if (set.has(k)) hits.push(k);
    }
    if (group === WORKFORCE_XOR) {
      if (set.has("platform_workforce") && !set.has("platform_workforce_base") && !set.has("platform_workforce_pro")) {
        set.add("platform_workforce_base");
        hits.push("platform_workforce_base");
      }
    }
    const uniqueHits = [...new Set(hits)];
    if (uniqueHits.length <= 1) continue;
    const keep =
      prefer && uniqueHits.includes(prefer)
        ? prefer
        : uniqueHits[uniqueHits.length - 1]!;
    for (const h of uniqueHits) {
      if (h !== keep) set.delete(h);
    }
    set.add(keep);
  }

  if (set.has("platform_workforce_pro")) {
    set.delete("platform_workforce_base");
    set.add("platform_workforce");
  } else if (set.has("platform_workforce_base")) {
    set.delete("platform_workforce_pro");
    set.add("platform_workforce");
  }

  return expandCommercialClinicGrants([...set]);
}

export function expandCommercialClinicGrants(modules: readonly string[]): string[] {
  const set = new Set(modules);
  for (const [parent, children] of Object.entries(CLINIC_COMMERCIAL_GRANTS)) {
    if (!set.has(parent)) continue;
    for (const c of children) set.add(c);
  }
  return [...set];
}

/** Hotel Sanatorium bundle must not coexist with clinic sanatorium SKU. */
export function bundleConflictsWithModules(
  bundleName: string,
  bundleModuleKeys: readonly string[],
  activeModules: readonly string[],
): boolean {
  if (bundleName !== HOTEL_SANATORIUM_BUNDLE_NAME) return false;
  if (!bundleModuleKeys.includes("hotel_medical_sanatorium")) return false;
  return activeModules.includes("clinic_sanatorium_clinical");
}
