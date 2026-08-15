"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLINIC_PRICING_MODULE_KEYS = exports.BANKING_PRICING_MODULE_KEYS = exports.INDUSTRY_SATELLITE_MODULE_KEYS = exports.HOTEL_PRICING_BUNDLE_KEYS = exports.HOTEL_LEGACY_MODULE_KEYS = exports.HOTEL_MODULE_KEY_ALIASES = exports.HOTEL_PRICING_MODULE_KEYS = void 0;
exports.resolveHotelModuleKey = resolveHotelModuleKey;
exports.consolidateHotelModuleKeys = consolidateHotelModuleKeys;
exports.isHotelModuleActive = isHotelModuleActive;
exports.isPassThroughCatalogModuleKey = isPassThroughCatalogModuleKey;
exports.inferPricingCatalogKind = inferPricingCatalogKind;
/** Canonical hotel PMS submodule keys (`pricing_modules`) — hotel submodule taxonomy. */
exports.HOTEL_PRICING_MODULE_KEYS = [
    "hotel_core",
    "hotel_housekeeping",
    "hotel_service",
    "hotel_migration_pro",
    "hotel_transfers",
    "hotel_spa_scheduling",
    "hotel_distribution",
    "hotel_guest_experience",
    "hotel_banquets",
    "hotel_medical_sanatorium",
    "hotel_setup_advanced",
];
/** Legacy keys consolidated into the 9-key taxonomy (dual-read). */
exports.HOTEL_MODULE_KEY_ALIASES = {
    hotel_front_office: "hotel_core",
    hotel_front_cash: "hotel_core",
    hotel_night_audit: "hotel_core",
    hotel_channel_ota: "hotel_distribution",
    hotel_contracts_yield: "hotel_distribution",
    migration_pro: "hotel_migration_pro",
};
/** @deprecated Use HOTEL_MODULE_KEY_ALIASES */
exports.HOTEL_LEGACY_MODULE_KEYS = Object.keys(exports.HOTEL_MODULE_KEY_ALIASES);
exports.HOTEL_PRICING_BUNDLE_KEYS = {
    CITY: "hotel_bundle_city",
    RESORT: "hotel_bundle_resort",
    SANATORIUM: "hotel_bundle_sanatorium",
};
exports.INDUSTRY_SATELLITE_MODULE_KEYS = [
    "industry_hotel_pms",
    "industry_fnb_pos",
    "industry_retail",
    "industry_logistics",
    "industry_construction",
    "industry_crm",
    "industry_auto_service",
    "industry_clinic",
    "industry_wholesale",
    "industry_banking",
];
exports.BANKING_PRICING_MODULE_KEYS = [
    "banking_core",
    "banking_deposits",
    "banking_loans",
    "banking_cards",
    "banking_payments",
    "banking_aml",
    "banking_treasury",
    "banking_dbo",
    "banking_regreporting",
    "banking_risk",
    "banking_trade",
    "banking_collections",
    "banking_cash",
    "banking_islamic",
    "banking_wealth",
];
/** Clinic modules (MODULES_CATALOG M0–M14). */
exports.CLINIC_PRICING_MODULE_KEYS = [
    "clinic_shell",
    "clinic_patients",
    "clinic_schedule",
    "clinic_appointments",
    "clinic_visit",
    "clinic_lab",
    "clinic_service_catalog",
    "clinic_notifications",
    "clinic_portal",
    "clinic_reschedule",
    "clinic_ehr",
    "clinic_lis_import",
    "clinic_insurance",
    "clinic_inpatient",
    "clinic_telehealth",
];
/** Resolve canonical hotel module key (handles legacy slugs). */
function resolveHotelModuleKey(moduleKey) {
    return exports.HOTEL_MODULE_KEY_ALIASES[moduleKey] ?? moduleKey;
}
/** Consolidate legacy hotel keys in an activeModules array. */
function consolidateHotelModuleKeys(modules) {
    const out = new Set();
    for (const raw of modules) {
        const key = raw.trim();
        if (!key)
            continue;
        out.add(resolveHotelModuleKey(key));
    }
    return [...out];
}
/** True when snapshot activeModules includes module (legacy alias aware). */
function isHotelModuleActive(activeModules, moduleKey) {
    const canonical = resolveHotelModuleKey(moduleKey);
    const set = new Set(activeModules.map((m) => resolveHotelModuleKey(m)));
    return set.has(canonical);
}
function isPassThroughCatalogModuleKey(moduleKey) {
    return (moduleKey.startsWith("hotel_") ||
        moduleKey.startsWith("clinic_") ||
        moduleKey.startsWith("banking_") ||
        moduleKey.startsWith("industry_") ||
        moduleKey.startsWith("platform_"));
}
/** Infer PricingCatalogKind from module key prefix. */
function inferPricingCatalogKind(key) {
    if (key.startsWith("industry_"))
        return "SATELLITE";
    if (key.startsWith("platform_"))
        return "ADDON";
    return "MODULE";
}
