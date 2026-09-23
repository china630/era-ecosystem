"use strict";
/**
 * Commercial catalog freeze (2026-09): palette 19/29/39/99 AZN, XOR mutex,
 * commercial clinic SKUs, capacity meters. Entitlement + seed share this file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTLET_OVERAGE_AZN = exports.CLINIC_MODULE_CAPACITY = exports.CLINIC_CAPACITY_UNIT_AZN = exports.CLINIC_CAPACITY_INCLUDED = exports.CAPACITY_DRIVERS = exports.PASS_THROUGH_CATALOG_KEYS = exports.INDUSTRY_SUBMODULE_PREFIX_TO_GATE = exports.CLINIC_COMMERCIAL_MODULE_KEYS = exports.RETIRED_CLINIC_MODULE_KEYS = exports.ONE_SHOT_CATALOG_KEYS = exports.CATALOG_MUTEX_GROUPS = exports.WORKFORCE_HUB_KEYS = exports.WORKFORCE_XOR = exports.DATA_HUB_XOR = exports.CATALOG_PALETTE_AZN = void 0;
exports.isOneShotCatalogKey = isOneShotCatalogKey;
exports.isKafeEdition = isKafeEdition;
exports.shouldWaiveEraFoundation = shouldWaiveEraFoundation;
exports.isWorkforceHubKey = isWorkforceHubKey;
exports.inferSatelliteKeyFromModuleKey = inferSatelliteKeyFromModuleKey;
exports.isPassThroughCatalogModuleKeyExtended = isPassThroughCatalogModuleKeyExtended;
exports.isClinicFeatureEntitled = isClinicFeatureEntitled;
exports.applyCatalogMutex = applyCatalogMutex;
exports.rewriteClinicActiveModules = rewriteClinicActiveModules;
exports.clinicRoomBillableModule = clinicRoomBillableModule;
exports.clinicCapacityOverage = clinicCapacityOverage;
exports.CATALOG_PALETTE_AZN = [19, 29, 39, 99];
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
    ["platform_domain", "platform_domain_org"],
    ["platform_loyalty", "retail_promotions"],
    ["platform_delivery", "fnb_delivery_hub"],
    ["fnb_qr_menu", "platform_portal"],
];
exports.ONE_SHOT_CATALOG_KEYS = ["platform_onsite_visit"];
function isOneShotCatalogKey(key) {
    return exports.ONE_SHOT_CATALOG_KEYS.includes(key);
}
function isKafeEdition(org) {
    const plan = (org.subscriptionPlan ?? "").trim().toLowerCase();
    if (plan === "kafe")
        return true;
    const s = org.settings;
    if (s && typeof s === "object" && !Array.isArray(s)) {
        const rec = s;
        const edition = String(rec.edition ?? rec.signupSource ?? "").toLowerCase();
        if (edition === "kafe")
            return true;
    }
    return false;
}
function shouldWaiveEraFoundation(org) {
    if (!isKafeEdition(org))
        return false;
    const mods = org.activeModules ?? [];
    return !mods.some((m) => m === "nas" || m === "industry_finance");
}
exports.CLINIC_COMMERCIAL_MODULE_KEYS = [
    "clinic_registry_emr",
    "clinic_lab",
    "clinic_sanatorium",
    "clinic_nurse_roster",
    "clinic_inpatient",
    "clinic_telehealth",
    "clinic_insurance",
];
exports.RETIRED_CLINIC_MODULE_KEYS = [
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
];
const CLINIC_EMR_LEGACY_KEYS = [
    "clinic_patients",
    "clinic_visit",
    "clinic_ehr",
    "clinic_reschedule",
];
function rewriteClinicActiveModules(modules) {
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
    for (const k of exports.RETIRED_CLINIC_MODULE_KEYS) {
        set.delete(k);
    }
    return [...set];
}
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
exports.CLINIC_CAPACITY_INCLUDED = 5;
exports.CLINIC_CAPACITY_UNIT_AZN = 19;
exports.CLINIC_MODULE_CAPACITY = [
    { moduleKey: "clinic_registry_emr", included: 5, unitAzn: 19, unit: "room" },
    { moduleKey: "clinic_sanatorium", included: 5, unitAzn: 19, unit: "room" },
    { moduleKey: "clinic_inpatient", included: 5, unitAzn: 19, unit: "bed" },
];
function clinicRoomBillableModule(activeModules) {
    const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
    if (set.has("clinic_sanatorium"))
        return "clinic_sanatorium";
    if (set.has("clinic_registry_emr"))
        return "clinic_registry_emr";
    return null;
}
function clinicCapacityOverage(count, included = exports.CLINIC_CAPACITY_INCLUDED) {
    return Math.max(0, Math.floor(count) - included);
}
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
    return set.has(moduleKey);
}
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
    return [...set];
}
