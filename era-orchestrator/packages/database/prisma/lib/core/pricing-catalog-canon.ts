/**
 * Commercial catalog freeze (2026-09): palette 19/29/39/99 AZN, XOR mutex,
 * commercial clinic SKUs, capacity meters. Entitlement + seed share this file.
 */

export const CATALOG_PALETTE_AZN = [19, 29, 39, 99] as const;

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
  ["platform_domain", "platform_domain_org"],
  ["platform_loyalty", "retail_promotions"],
  ["platform_delivery", "fnb_delivery_hub"],
  ["fnb_qr_menu", "platform_portal"],
];

/** One-shot SKUs — billed at toggle, never on the monthly Foundation run. */
export const ONE_SHOT_CATALOG_KEYS = ["platform_onsite_visit"] as const;

export function isOneShotCatalogKey(key: string): boolean {
  return (ONE_SHOT_CATALOG_KEYS as readonly string[]).includes(key);
}

export function isKafeEdition(org: {
  subscriptionPlan?: string | null;
  settings?: unknown;
}): boolean {
  const plan = (org.subscriptionPlan ?? "").trim().toLowerCase();
  if (plan === "kafe") return true;
  const s = org.settings;
  if (s && typeof s === "object" && !Array.isArray(s)) {
    const rec = s as Record<string, unknown>;
    const edition = String(rec.edition ?? rec.signupSource ?? "").toLowerCase();
    if (edition === "kafe") return true;
  }
  return false;
}

/** Street Kafe: waive ERA Foundation until NAS / finance satellite is on. */
export function shouldWaiveEraFoundation(org: {
  subscriptionPlan?: string | null;
  settings?: unknown;
  activeModules?: readonly string[] | null;
}): boolean {
  if (!isKafeEdition(org)) return false;
  const mods = org.activeModules ?? [];
  return !mods.some((m) => m === "nas" || m === "industry_finance");
}

/** Paid clinic SKUs — one key per process. Gate `industry_clinic` is separate. */
export const CLINIC_COMMERCIAL_MODULE_KEYS = [
  "clinic_registry_emr",
  "clinic_lab",
  "clinic_sanatorium",
  "clinic_nurse_roster",
  "clinic_inpatient",
  "clinic_telehealth",
  "clinic_insurance",
] as const;

/** Retired zero-price / renamed clinic keys. Dropped from seed and entitlements. */
export const RETIRED_CLINIC_MODULE_KEYS = [
  "clinic_shell",
  "clinic_schedule",
  "clinic_appointments",
  "clinic_service_catalog",
  "clinic_patients",
  "clinic_visit",
  "clinic_ehr",
  "clinic_reschedule",
  "clinic_lis_import",
  "clinic_portal",
  "clinic_notifications",
  "clinic_sanatorium_clinical",
] as const;

const CLINIC_EMR_LEGACY_KEYS = [
  "clinic_patients",
  "clinic_visit",
  "clinic_ehr",
  "clinic_reschedule",
] as const;

/** Rewrite stored `activeModules` onto the 7-SKU clinic catalog. */
export function rewriteClinicActiveModules(modules: readonly string[]): string[] {
  const set = new Set(modules.map((m) => m.trim()).filter(Boolean));
  if (set.has("clinic_sanatorium_clinical")) {
    set.add("clinic_sanatorium");
  }
  if (CLINIC_EMR_LEGACY_KEYS.some((k) => set.has(k))) {
    set.add("clinic_registry_emr");
  }
  if (set.has("clinic_lis_import")) {
    set.add("clinic_lab");
  }
  for (const k of RETIRED_CLINIC_MODULE_KEYS) {
    set.delete(k);
  }
  return [...set];
}

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

export const CLINIC_CAPACITY_INCLUDED = 5;
export const CLINIC_CAPACITY_UNIT_AZN = 19;

export type ClinicModuleCapacityDef = {
  moduleKey: string;
  included: number;
  unitAzn: number;
  unit: "room" | "bed";
};

/** Cabinets (Room) and beds billed on the institution module, not the gate. */
export const CLINIC_MODULE_CAPACITY: readonly ClinicModuleCapacityDef[] = [
  { moduleKey: "clinic_registry_emr", included: CLINIC_CAPACITY_INCLUDED, unitAzn: CLINIC_CAPACITY_UNIT_AZN, unit: "room" },
  { moduleKey: "clinic_sanatorium", included: CLINIC_CAPACITY_INCLUDED, unitAzn: CLINIC_CAPACITY_UNIT_AZN, unit: "room" },
  { moduleKey: "clinic_inpatient", included: CLINIC_CAPACITY_INCLUDED, unitAzn: CLINIC_CAPACITY_UNIT_AZN, unit: "bed" },
];

/** One room census per org — sanatorium wins over EMR so Nafta is not billed twice. */
export function clinicRoomBillableModule(
  activeModules: readonly string[],
): "clinic_sanatorium" | "clinic_registry_emr" | null {
  const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
  if (set.has("clinic_sanatorium")) return "clinic_sanatorium";
  if (set.has("clinic_registry_emr")) return "clinic_registry_emr";
  return null;
}

export function clinicCapacityOverage(
  count: number,
  included = CLINIC_CAPACITY_INCLUDED,
): number {
  return Math.max(0, Math.floor(count) - included);
}

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
  return set.has(moduleKey);
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

  return [...set];
}
