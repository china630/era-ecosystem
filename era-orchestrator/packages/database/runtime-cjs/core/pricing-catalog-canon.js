"use strict";
/**
 * Commercial catalog freeze (2026-09): palette 19/29/39/99 AZN, XOR mutex,
 * commercial clinic SKUs, capacity meters. Entitlement + seed share this file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFORCE_HEADCOUNT_RATE_AZN = exports.CLINIC_MODULE_CAPACITY = exports.CLINIC_CAPACITY_UNIT_AZN = exports.CLINIC_CAPACITY_INCLUDED = exports.OUTLET_OVERAGE_AZN = exports.CAPACITY_DRIVERS = exports.PASS_THROUGH_CATALOG_KEYS = exports.INDUSTRY_SUBMODULE_PREFIX_TO_GATE = exports.RETIRED_CLINIC_MODULE_KEYS = exports.CLINIC_COMMERCIAL_MODULE_KEYS = exports.ONE_SHOT_CATALOG_KEYS = exports.CATALOG_MUTEX_GROUPS = exports.WORKFORCE_HUB_KEYS = exports.WORKFORCE_XOR = exports.DATA_HUB_XOR = exports.CATALOG_PALETTE_AZN = void 0;
exports.isOneShotCatalogKey = isOneShotCatalogKey;
exports.isKafeEdition = isKafeEdition;
exports.isKafeSignup = isKafeSignup;
exports.shouldWaiveEraFoundation = shouldWaiveEraFoundation;
exports.rewriteClinicActiveModules = rewriteClinicActiveModules;
exports.clinicRoomBillableModule = clinicRoomBillableModule;
exports.clinicCapacityOverage = clinicCapacityOverage;
exports.isWorkforceHubKey = isWorkforceHubKey;
exports.inferSatelliteKeyFromModuleKey = inferSatelliteKeyFromModuleKey;
exports.isPassThroughCatalogModuleKeyExtended = isPassThroughCatalogModuleKeyExtended;
exports.isClinicFeatureEntitled = isClinicFeatureEntitled;
exports.applyCatalogMutex = applyCatalogMutex;
exports.workforcePackageRank = workforcePackageRank;
exports.workforceFeatureAllowed = workforceFeatureAllowed;
exports.workforceUpgradeSlug = workforceUpgradeSlug;
exports.workforceHeadcountRateAzn = workforceHeadcountRateAzn;
exports.workforceFeatureForPath = workforceFeatureForPath;
exports.workforceNavHref = workforceNavHref;
exports.CATALOG_PALETTE_AZN = [19, 29, 39, 99];
exports.DATA_HUB_XOR = [
    "platform_reference_data",
    "platform_datahub_silver",
    "platform_datahub_gold",
];
exports.WORKFORCE_XOR = [
    "platform_workforce_base",
    "platform_workforce_pro",
    "platform_workforce_premium",
];
exports.WORKFORCE_HUB_KEYS = [
    "platform_workforce",
    "platform_workforce_base",
    "platform_workforce_pro",
    "platform_workforce_premium",
];
exports.CATALOG_MUTEX_GROUPS = [
    exports.DATA_HUB_XOR,
    exports.WORKFORCE_XOR,
    ["platform_domain", "platform_domain_org"],
    ["platform_loyalty", "retail_promotions"],
    ["platform_delivery", "fnb_delivery_hub"],
    ["fnb_qr_menu", "platform_portal"],
];
/** One-shot SKUs — billed at toggle, never on the monthly Foundation run. */
exports.ONE_SHOT_CATALOG_KEYS = ["platform_onsite_visit"];
function isOneShotCatalogKey(key) {
    return exports.ONE_SHOT_CATALOG_KEYS.includes(key);
}
function orgSettingsRecord(settings) {
    return settings && typeof settings === "object" && !Array.isArray(settings)
        ? settings
        : {};
}
/** F&B edition today. `settings.edition` wins; `fnb` = upgraded to full F&B. */
function isKafeEdition(org) {
    const rec = orgSettingsRecord(org.settings);
    const edition = String(rec.edition ?? "").trim().toLowerCase();
    if (edition)
        return edition === "kafe";
    const plan = (org.subscriptionPlan ?? "").trim().toLowerCase();
    if (plan === "kafe")
        return true;
    return String(rec.signupSource ?? "").trim().toLowerCase() === "kafe";
}
/** Signed up through ERA Kafe, whatever the edition is now. */
function isKafeSignup(org) {
    if (isKafeEdition(org))
        return true;
    return String(orgSettingsRecord(org.settings).signupSource ?? "").trim().toLowerCase() === "kafe";
}
/**
 * Street F&B signed up through Kafe: waive ERA Foundation until NAS / finance satellite is on.
 * Upgrading the edition to full F&B does not add a price line.
 */
function shouldWaiveEraFoundation(org) {
    if (!isKafeSignup(org))
        return false;
    const mods = org.activeModules ?? [];
    return !mods.some((m) => m === "nas" || m === "industry_finance");
}
/** Paid clinic SKUs — one key per process. Gate `industry_clinic` is separate. */
exports.CLINIC_COMMERCIAL_MODULE_KEYS = [
    "clinic_registry_emr",
    "clinic_lab",
    "clinic_sanatorium",
    "clinic_nurse_roster",
    "clinic_inpatient",
    "clinic_telehealth",
    "clinic_insurance",
];
/** Retired zero-price / renamed clinic keys. Dropped from seed and entitlements. */
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
/** Rewrite stored `activeModules` onto the 7-SKU clinic catalog. */
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
/** Cabinets (Room) and beds billed on the institution module, not the gate. */
exports.CLINIC_MODULE_CAPACITY = [
    { moduleKey: "clinic_registry_emr", included: exports.CLINIC_CAPACITY_INCLUDED, unitAzn: exports.CLINIC_CAPACITY_UNIT_AZN, unit: "room" },
    { moduleKey: "clinic_sanatorium", included: exports.CLINIC_CAPACITY_INCLUDED, unitAzn: exports.CLINIC_CAPACITY_UNIT_AZN, unit: "room" },
    { moduleKey: "clinic_inpatient", included: exports.CLINIC_CAPACITY_INCLUDED, unitAzn: exports.CLINIC_CAPACITY_UNIT_AZN, unit: "bed" },
];
/** One room census per org — sanatorium wins over EMR so Nafta is not billed twice. */
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
/**
 * Keep at most one SKU per XOR group. `prefer` wins when present in the group
 * (the slug just enabled). Workforce hub alias: Essential/Professional/Premium keep `platform_workforce`.
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
            if (set.has("platform_workforce") &&
                !set.has("platform_workforce_base") &&
                !set.has("platform_workforce_pro") &&
                !set.has("platform_workforce_premium")) {
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
    if (set.has("platform_workforce_premium")) {
        set.delete("platform_workforce_base");
        set.delete("platform_workforce_pro");
        set.add("platform_workforce");
    }
    else if (set.has("platform_workforce_pro")) {
        set.delete("platform_workforce_base");
        set.delete("platform_workforce_premium");
        set.add("platform_workforce");
    }
    else if (set.has("platform_workforce_base")) {
        set.delete("platform_workforce_pro");
        set.delete("platform_workforce_premium");
        set.add("platform_workforce");
    }
    return [...set];
}
/** Per-person Workforce price. Package slug monthly price stays 0. */
exports.WORKFORCE_HEADCOUNT_RATE_AZN = {
    essential: 2,
    professional: 4,
    premium: 6,
};
const WORKFORCE_FEATURE_RANK = {
    hire: 1,
    org: 1,
    security: 1,
    importExport: 1,
    absence: 2,
    vacation: 2,
    shifts: 2,
    timesheet: 2,
    planFact: 2,
    cabinet: 2,
    floor: 3,
    orders: 3,
    staffSchedule: 3,
    fitness: 3,
    group: 3,
};
const WORKFORCE_PACKAGE_SLUG = {
    essential: "platform_workforce_base",
    professional: "platform_workforce_pro",
    premium: "platform_workforce_premium",
};
/**
 * 0 = no workforce. A hub slug without a package is Essential, same as a fresh
 * toggle. Premium for orgs that already had the hub is written by migration
 * `20261005120000_workforce_packages`, not inferred here.
 */
function workforcePackageRank(modules) {
    const set = new Set(modules.map((m) => m.trim()).filter(Boolean));
    if (set.has("platform_workforce_premium"))
        return 3;
    if (set.has("platform_workforce_pro"))
        return 2;
    if (set.has("platform_workforce_base") || set.has("platform_workforce"))
        return 1;
    return 0;
}
function workforceFeatureAllowed(modules, feature) {
    const rank = workforcePackageRank(modules);
    return rank >= WORKFORCE_FEATURE_RANK[feature];
}
function workforceUpgradeSlug(feature) {
    const rank = WORKFORCE_FEATURE_RANK[feature];
    if (rank <= 1)
        return WORKFORCE_PACKAGE_SLUG.essential;
    if (rank === 2)
        return WORKFORCE_PACKAGE_SLUG.professional;
    return WORKFORCE_PACKAGE_SLUG.premium;
}
function workforceHeadcountRateAzn(modules) {
    const rank = workforcePackageRank(modules);
    if (rank === 3)
        return exports.WORKFORCE_HEADCOUNT_RATE_AZN.premium;
    if (rank === 2)
        return exports.WORKFORCE_HEADCOUNT_RATE_AZN.professional;
    if (rank === 1)
        return exports.WORKFORCE_HEADCOUNT_RATE_AZN.essential;
    return 0;
}
const WORKFORCE_NAV = [
    { prefix: "/workspace/workforce/security", feature: "security" },
    { prefix: "/workspace/workforce/employments", feature: "hire" },
    { prefix: "/workspace/workforce/org-structure", feature: "org" },
    { prefix: "/workspace/workforce/positions", feature: "org" },
    { prefix: "/workspace/workforce/export", feature: "importExport" },
    { prefix: "/workspace/workforce/migration", feature: "importExport" },
    { prefix: "/workspace/workforce/import", feature: "importExport" },
    { prefix: "/workspace/workforce/absences", feature: "absence" },
    { prefix: "/workspace/workforce/vacation-plans", feature: "vacation" },
    { prefix: "/workspace/workforce/places", feature: "shifts" },
    { prefix: "/workspace/workforce/shifts", feature: "shifts" },
    { prefix: "/workspace/workforce/roster", feature: "shifts" },
    { prefix: "/workspace/workforce/timesheets", feature: "timesheet" },
    { prefix: "/workspace/workforce/plan-fact", feature: "planFact" },
    { prefix: "/workspace/workforce/requests", feature: "cabinet" },
    { prefix: "/workspace/me", feature: "cabinet" },
    { prefix: "/workspace/workforce/attendance", feature: "floor" },
    { prefix: "/workspace/workforce/floor", feature: "floor" },
    { prefix: "/workspace/workforce/personnel-orders", feature: "orders" },
    { prefix: "/workspace/workforce/staff-schedule", feature: "staffSchedule" },
    { prefix: "/workspace/workforce/fitness", feature: "fitness" },
    { prefix: "/workspace/workforce/group", feature: "group" },
];
function workforceFeatureForPath(pathname) {
    const hit = WORKFORCE_NAV.find((row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}/`));
    return hit?.feature ?? null;
}
/** Real path while the package is unknown or high enough. Otherwise the upgrade anchor. */
function workforceNavHref(pathname, modules) {
    if (!modules)
        return pathname;
    const feature = workforceFeatureForPath(pathname);
    if (!feature)
        return pathname;
    const rank = workforcePackageRank(modules);
    if (rank === 0)
        return pathname;
    if (workforceFeatureAllowed(modules, feature))
        return pathname;
    return `/pricing#${workforceUpgradeSlug(feature)}`;
}
