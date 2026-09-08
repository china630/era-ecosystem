"use strict";
/**
 * Commercial catalog freeze (2026-09): palette 19/29/39/99 AZN, XOR mutex,
 * commercial clinic SKUs, capacity meters. Entitlement + seed share this file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTLET_OVERAGE_AZN = exports.CAPACITY_DRIVERS = exports.PASS_THROUGH_CATALOG_KEYS = exports.INDUSTRY_SUBMODULE_PREFIX_TO_GATE = exports.CLINIC_COMMERCIAL_MODULE_KEYS = exports.CLINIC_FEATURE_PARENTS = exports.CLINIC_COMMERCIAL_GRANTS = exports.CATALOG_MUTEX_GROUPS = exports.WORKFORCE_HUB_KEYS = exports.WORKFORCE_XOR = exports.DATA_HUB_XOR = exports.HOTEL_SANATORIUM_BUNDLE_NAME = exports.CATALOG_PALETTE_AZN = void 0;
exports.isWorkforceHubKey = isWorkforceHubKey;
exports.inferSatelliteKeyFromModuleKey = inferSatelliteKeyFromModuleKey;
exports.isPassThroughCatalogModuleKeyExtended = isPassThroughCatalogModuleKeyExtended;
exports.isClinicFeatureEntitled = isClinicFeatureEntitled;
exports.applyCatalogMutex = applyCatalogMutex;
exports.expandCommercialClinicGrants = expandCommercialClinicGrants;
exports.bundleConflictsWithModules = bundleConflictsWithModules;
exports.CATALOG_PALETTE_AZN = [19, 29, 39, 99];
exports.HOTEL_SANATORIUM_BUNDLE_NAME = "Hotel Sanatorium";
exports.DATA_HUB_XOR = [
    "platform_reference_data",
    "platform_datahub_silver",
    "platform_datahub_gold",
];
exports.WORKFORCE_XOR = [
    "platform_workforce_base",
    "platform_workforce_pro",
];
exports.WORKFORCE_HUB_KEYS = [
    "platform_workforce",
    "platform_workforce_base",
    "platform_workforce_pro",
];
exports.CATALOG_MUTEX_GROUPS = [
    exports.DATA_HUB_XOR,
    exports.WORKFORCE_XOR,
    ["platform_loyalty", "retail_promotions"],
    ["platform_delivery", "fnb_delivery_hub"],
    ["hotel_medical_sanatorium", "clinic_sanatorium_clinical"],
];
/** Child feature keys granted when a commercial parent SKU is on (price 0). */
exports.CLINIC_COMMERCIAL_GRANTS = {
    clinic_registry_emr: [
        "clinic_patients",
        "clinic_visit",
        "clinic_ehr",
        "clinic_reschedule",
    ],
    clinic_lab: ["clinic_lis_import"],
};
/** Feature key → commercial parents that also entitle it. */
exports.CLINIC_FEATURE_PARENTS = {
    clinic_patients: ["clinic_registry_emr"],
    clinic_visit: ["clinic_registry_emr"],
    clinic_ehr: ["clinic_registry_emr"],
    clinic_reschedule: ["clinic_registry_emr"],
    clinic_lis_import: ["clinic_lab"],
};
exports.CLINIC_COMMERCIAL_MODULE_KEYS = [
    "clinic_nurse_roster",
    "clinic_registry_emr",
    "clinic_sanatorium_clinical",
];
exports.INDUSTRY_SUBMODULE_PREFIX_TO_GATE = {
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
exports.PASS_THROUGH_CATALOG_KEYS = [
    "nas",
    "fixed_assets",
    "consolidation_pro",
];
exports.CAPACITY_DRIVERS = [
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
exports.OUTLET_OVERAGE_AZN = 19;
function isWorkforceHubKey(key) {
    return exports.WORKFORCE_HUB_KEYS.includes(key);
}
function inferSatelliteKeyFromModuleKey(key) {
    for (const [prefix, gate] of Object.entries(exports.INDUSTRY_SUBMODULE_PREFIX_TO_GATE)) {
        if (key.startsWith(prefix))
            return gate;
    }
    return null;
}
function isPassThroughCatalogModuleKeyExtended(moduleKey) {
    if (exports.PASS_THROUGH_CATALOG_KEYS.includes(moduleKey))
        return true;
    for (const prefix of Object.keys(exports.INDUSTRY_SUBMODULE_PREFIX_TO_GATE)) {
        if (moduleKey.startsWith(prefix))
            return true;
    }
    return moduleKey.startsWith("industry_") || moduleKey.startsWith("platform_");
}
function isClinicFeatureEntitled(activeModules, moduleKey) {
    const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
    if (set.has(moduleKey))
        return true;
    for (const parent of exports.CLINIC_FEATURE_PARENTS[moduleKey] ?? []) {
        if (set.has(parent))
            return true;
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
function applyCatalogMutex(modules, prefer) {
    const set = new Set(modules.map((m) => m.trim()).filter(Boolean));
    for (const group of exports.CATALOG_MUTEX_GROUPS) {
        const hits = [];
        for (const k of group) {
            if (set.has(k))
                hits.push(k);
        }
        if (group === exports.WORKFORCE_XOR) {
            if (set.has("platform_workforce") && !set.has("platform_workforce_base") && !set.has("platform_workforce_pro")) {
                set.add("platform_workforce_base");
                hits.push("platform_workforce_base");
            }
        }
        const uniqueHits = [...new Set(hits)];
        if (uniqueHits.length <= 1)
            continue;
        const keep = prefer && uniqueHits.includes(prefer)
            ? prefer
            : uniqueHits[uniqueHits.length - 1];
        for (const h of uniqueHits) {
            if (h !== keep)
                set.delete(h);
        }
        set.add(keep);
    }
    if (set.has("platform_workforce_pro")) {
        set.delete("platform_workforce_base");
        set.add("platform_workforce");
    }
    else if (set.has("platform_workforce_base")) {
        set.delete("platform_workforce_pro");
        set.add("platform_workforce");
    }
    return expandCommercialClinicGrants([...set]);
}
function expandCommercialClinicGrants(modules) {
    const set = new Set(modules);
    for (const [parent, children] of Object.entries(exports.CLINIC_COMMERCIAL_GRANTS)) {
        if (!set.has(parent))
            continue;
        for (const c of children)
            set.add(c);
    }
    return [...set];
}
/** Hotel Sanatorium bundle must not coexist with clinic sanatorium SKU. */
function bundleConflictsWithModules(bundleName, bundleModuleKeys, activeModules) {
    if (bundleName !== exports.HOTEL_SANATORIUM_BUNDLE_NAME)
        return false;
    if (!bundleModuleKeys.includes("hotel_medical_sanatorium"))
        return false;
    return activeModules.includes("clinic_sanatorium_clinical");
}
