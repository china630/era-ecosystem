export declare const CATALOG_PALETTE_AZN: readonly [19, 29, 39, 99];
export declare const DATA_HUB_XOR: readonly ["platform_reference_data", "platform_datahub_silver", "platform_datahub_gold"];
export declare const WORKFORCE_XOR: readonly ["platform_workforce_base", "platform_workforce_pro", "platform_workforce_premium"];
export declare const WORKFORCE_HUB_KEYS: readonly ["platform_workforce", "platform_workforce_base", "platform_workforce_pro", "platform_workforce_premium"];
export declare const CATALOG_MUTEX_GROUPS: readonly (readonly string[])[];
export declare const ONE_SHOT_CATALOG_KEYS: readonly ["platform_onsite_visit"];
export declare function isOneShotCatalogKey(key: string): boolean;
export declare function isKafeEdition(org: {
    subscriptionPlan?: string | null;
    settings?: unknown;
}): boolean;
export declare function isKafeSignup(org: {
    subscriptionPlan?: string | null;
    settings?: unknown;
}): boolean;
export declare function shouldWaiveEraFoundation(org: {
    subscriptionPlan?: string | null;
    settings?: unknown;
    activeModules?: readonly string[] | null;
}): boolean;
export declare const CLINIC_COMMERCIAL_MODULE_KEYS: readonly ["clinic_registry_emr", "clinic_lab", "clinic_sanatorium", "clinic_nurse_roster", "clinic_inpatient", "clinic_telehealth", "clinic_insurance"];
export declare const RETIRED_CLINIC_MODULE_KEYS: readonly ["clinic_shell", "clinic_schedule", "clinic_appointments", "clinic_service_catalog", "clinic_patients", "clinic_visit", "clinic_ehr", "clinic_reschedule", "clinic_lis_import", "clinic_portal", "clinic_notifications", "clinic_sanatorium_clinical"];
export declare function rewriteClinicActiveModules(modules: readonly string[]): string[];
export declare const INDUSTRY_SUBMODULE_PREFIX_TO_GATE: Readonly<Record<string, string>>;
export declare const PASS_THROUGH_CATALOG_KEYS: readonly ["nas", "fixed_assets", "consolidation_pro"];
export type CapacityDriverDef = {
    satelliteKey: string;
    includedInGate: number;
    unitAzn: number;
    unit: string;
};
export declare const CAPACITY_DRIVERS: readonly CapacityDriverDef[];
export declare const OUTLET_OVERAGE_AZN = 19;
export declare const CLINIC_CAPACITY_INCLUDED = 5;
export declare const CLINIC_CAPACITY_UNIT_AZN = 19;
export type ClinicModuleCapacityDef = {
    moduleKey: string;
    included: number;
    unitAzn: number;
    unit: "room" | "bed";
};
export declare const CLINIC_MODULE_CAPACITY: readonly ClinicModuleCapacityDef[];
export declare function clinicRoomBillableModule(activeModules: readonly string[]): "clinic_sanatorium" | "clinic_registry_emr" | null;
export declare function clinicCapacityOverage(count: number, included?: number): number;
export declare function isWorkforceHubKey(key: string): boolean;
export declare function inferSatelliteKeyFromModuleKey(key: string): string | null;
export declare function isPassThroughCatalogModuleKeyExtended(moduleKey: string): boolean;
export declare function isClinicFeatureEntitled(activeModules: readonly string[], moduleKey: string): boolean;
export declare function applyCatalogMutex(modules: readonly string[], prefer?: string): string[];
export declare const WORKFORCE_HEADCOUNT_RATE_AZN: {
    readonly essential: 2;
    readonly professional: 4;
    readonly premium: 6;
};
export type WorkforcePackageId = keyof typeof WORKFORCE_HEADCOUNT_RATE_AZN;
export type WorkforceFeature = "hire" | "org" | "security" | "importExport" | "absence" | "vacation" | "shifts" | "timesheet" | "planFact" | "cabinet" | "floor" | "orders" | "staffSchedule" | "fitness" | "group";
export declare function workforcePackageRank(modules: readonly string[]): 0 | 1 | 2 | 3;
export declare function workforceFeatureAllowed(modules: readonly string[], feature: WorkforceFeature): boolean;
export declare function workforceUpgradeSlug(feature: WorkforceFeature): string;
export declare function workforceHeadcountRateAzn(modules: readonly string[]): number;
export declare function workforceFeatureForPath(pathname: string): WorkforceFeature | null;
export declare function workforceNavHref(pathname: string, modules: readonly string[] | null): string;
