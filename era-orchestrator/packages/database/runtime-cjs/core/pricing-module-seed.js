"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_MODULE_SEED_DEFAULTS = void 0;
exports.seedPricingModuleIfEmpty = seedPricingModuleIfEmpty;
exports.ensureMissingPricingModules = ensureMissingPricingModules;
exports.syncPricingModuleCatalog = syncPricingModuleCatalog;
const client_1 = require("../../generated/client");
const pricing_module_keys_1 = require("./pricing-module-keys");
const hotel_module_keys_1 = require("./hotel-module-keys");
const pricing_catalog_canon_1 = require("./pricing-catalog-canon");
const FINANCE_TRIAL_ELIGIBLE = new Set([
    "nas",
    "ifrs_mapping",
    "manufacturing",
    "fixed_assets",
    "inventory",
    "hr_full",
    "audit_hub",
    pricing_module_keys_1.PRICING_MODULE_CASH_BANK_PRO,
]);
const INDUSTRY_TRIAL_ELIGIBLE = new Set(hotel_module_keys_1.INDUSTRY_SATELLITE_MODULE_KEYS);
const INDUSTRY_SATELLITE_SEED = [
    { key: "industry_hotel_pms", name: "Hotel PMS", sortOrder: 100, pricePerMonth: 29 },
    { key: "industry_fnb_pos", name: "F&B POS", sortOrder: 101, pricePerMonth: 29 },
    { key: "industry_retail", name: "Retail POS", sortOrder: 102, pricePerMonth: 29 },
    { key: "industry_logistics", name: "Logistics", sortOrder: 103, pricePerMonth: 29 },
    { key: "industry_construction", name: "Construction", sortOrder: 104, pricePerMonth: 29 },
    { key: "industry_crm", name: "CRM Field", sortOrder: 105, pricePerMonth: 29 },
    { key: "industry_auto_service", name: "Auto STO", sortOrder: 106, pricePerMonth: 29 },
    { key: "industry_clinic", name: "Clinic", sortOrder: 107, pricePerMonth: 29 },
    { key: "industry_wholesale", name: "Wholesale", sortOrder: 108, pricePerMonth: 29 },
    { key: "industry_banking", name: "Bank CBS (Sandbox / Pilot)", sortOrder: 109, pricePerMonth: 99 },
];
/**
 * Canonical defaults for `pricing_modules` — synced with Super-Admin catalog (2026-05).
 */
exports.PRICING_MODULE_SEED_DEFAULTS = [
    {
        key: pricing_module_keys_1.PRICING_MODULE_CASH_BANK_PRO,
        name: "Cash & Bank Pro",
        pricePerMonth: 39,
        sortOrder: 0,
        isPremium: false,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    {
        key: "nas",
        name: "General Ledger (NAS)",
        pricePerMonth: 29,
        sortOrder: 0,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    {
        key: "inventory",
        name: "Warehouse",
        pricePerMonth: 19,
        sortOrder: 1,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    {
        key: "manufacturing",
        name: "Manufacturing",
        pricePerMonth: 29,
        sortOrder: 2,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    {
        key: "hr_full",
        name: "HR & Payroll",
        pricePerMonth: 29,
        sortOrder: 3,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    {
        key: "platform_workforce",
        name: "Workforce Hub (CP)",
        pricePerMonth: 0,
        sortOrder: 3,
        trialEligibleInTrial: true,
    },
    {
        key: "platform_workforce_base",
        name: "Workforce Base (headcount meter)",
        pricePerMonth: 0,
        sortOrder: 31,
        trialEligibleInTrial: true,
    },
    {
        key: "platform_workforce_pro",
        name: "Workforce PRO (headcount meter + HRIS)",
        pricePerMonth: 0,
        sortOrder: 32,
        trialEligibleInTrial: true,
    },
    {
        key: "ifrs_mapping",
        name: "IFRS",
        pricePerMonth: 39,
        sortOrder: 4,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    { key: "tax_pro", name: "Tax Pro", pricePerMonth: 39, sortOrder: 10, isPremium: true },
    { key: "trade_pro", name: "Trade Pro", pricePerMonth: 39, sortOrder: 11, isPremium: true },
    { key: "audit_hub", name: "Audit Hub", pricePerMonth: 99, sortOrder: 12, isPremium: true },
    {
        key: "compliance_pro",
        name: "Risk & Compliance (ERM)",
        pricePerMonth: 99,
        sortOrder: 13,
        isPremium: true,
    },
    {
        key: "contract_management_pro",
        name: "Contract Management",
        pricePerMonth: 29,
        sortOrder: 14,
        isPremium: true,
    },
    {
        key: "gov_budget_pro",
        name: "Gov Budget (B2G)",
        pricePerMonth: 39,
        sortOrder: 15,
        isPremium: true,
    },
    {
        key: "platform_notifications",
        name: "Notifications Pack",
        pricePerMonth: 19,
        sortOrder: 20,
        isPremium: false,
    },
    {
        key: "platform_notifications_sms",
        name: "Notifications Pack — SMS",
        pricePerMonth: 0,
        sortOrder: 21,
        isPremium: false,
    },
    {
        key: "platform_storage",
        name: "Cloud Storage (S3)",
        pricePerMonth: 19,
        sortOrder: 22,
        isPremium: false,
    },
    {
        key: "platform_reference_data",
        name: "ERA Data Hub Bronze (Reference Data API)",
        pricePerMonth: 29,
        sortOrder: 23,
        isPremium: false,
    },
    {
        key: "platform_datahub_silver",
        name: "ERA Data Hub Silver (VÖEN enrich)",
        pricePerMonth: 39,
        sortOrder: 24,
        isPremium: false,
    },
    {
        key: "platform_datahub_gold",
        name: "ERA Data Hub Gold (real-time / BI)",
        pricePerMonth: 99,
        sortOrder: 25,
        isPremium: false,
    },
    {
        key: "platform_booking",
        name: "Universal Booking Engine",
        pricePerMonth: 29,
        sortOrder: 26,
        isPremium: false,
    },
    {
        key: "platform_portal",
        name: "Client Portal",
        pricePerMonth: 19,
        sortOrder: 27,
        isPremium: false,
    },
    {
        key: "platform_domain",
        name: "White-Label Domain",
        pricePerMonth: 19,
        sortOrder: 28,
        isPremium: false,
    },
    {
        key: "platform_loyalty",
        name: "Cross-Loyalty Engine",
        pricePerMonth: 29,
        sortOrder: 29,
        isPremium: false,
    },
    {
        key: "platform_delivery",
        name: "Delivery Orchestrator",
        pricePerMonth: 29,
        sortOrder: 30,
        isPremium: false,
    },
    {
        key: "platform_payments",
        name: "Fintech Gateway (take-rate)",
        pricePerMonth: 0,
        sortOrder: 33,
        isPremium: false,
    },
    ...INDUSTRY_SATELLITE_SEED.map((s) => ({
        key: s.key,
        name: s.name,
        pricePerMonth: s.pricePerMonth,
        sortOrder: s.sortOrder,
        isPremium: false,
        satelliteKey: null,
        trialEligibleInTrial: true,
    })),
    // Hotel PMS submodules (9-key taxonomy)
    {
        key: "hotel_core",
        name: "PMS Core (Front Office, Front Cash, Night Audit)",
        pricePerMonth: 29,
        sortOrder: 110,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_housekeeping",
        name: "Housekeeping & Room Rack",
        pricePerMonth: 19,
        sortOrder: 111,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_service",
        name: "Service & maintenance",
        pricePerMonth: 19,
        sortOrder: 1115,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_migration_pro",
        name: "Migration PRO (guest registration to migration service)",
        pricePerMonth: 39,
        sortOrder: 1116,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_distribution",
        name: "Distribution (Channel Manager & Contracts)",
        pricePerMonth: 29,
        sortOrder: 112,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_agency_portal",
        name: "Agency Portal (B2B extranet)",
        pricePerMonth: 39,
        sortOrder: 1125,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_guest_experience",
        name: "Guest Profiles & Tasks",
        pricePerMonth: 29,
        sortOrder: 113,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_spa_scheduling",
        name: "SPA & Procedures",
        pricePerMonth: 29,
        sortOrder: 114,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_transfers",
        name: "Transfers",
        pricePerMonth: 19,
        sortOrder: 115,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_banquets",
        name: "Banquets & BEO",
        pricePerMonth: 29,
        sortOrder: 116,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_medical_sanatorium",
        name: "Medical & Sanatorium",
        pricePerMonth: 39,
        sortOrder: 117,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_setup_advanced",
        name: "Advanced master data",
        pricePerMonth: 19,
        sortOrder: 118,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    // Clinic modules (MODULES_CATALOG M0–M14) — default free
    {
        key: "clinic_shell",
        name: "M0 Platform shell, SSO",
        pricePerMonth: 0,
        sortOrder: 200,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_patients",
        name: "M1 Patient registry",
        pricePerMonth: 0,
        sortOrder: 201,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_schedule",
        name: "M2 Practitioners, rooms, schedule",
        pricePerMonth: 0,
        sortOrder: 202,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_appointments",
        name: "M3 Appointment & check-in",
        pricePerMonth: 0,
        sortOrder: 203,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_visit",
        name: "M4 Visit card & clinical services",
        pricePerMonth: 0,
        sortOrder: 204,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_lab",
        name: "M5 Laboratory orders & results",
        pricePerMonth: 29,
        sortOrder: 205,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_service_catalog",
        name: "M6 Service catalog cache",
        pricePerMonth: 0,
        sortOrder: 206,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_notifications",
        name: "M7 Notifications (SMS/email)",
        pricePerMonth: 0,
        sortOrder: 207,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: false,
    },
    {
        key: "clinic_portal",
        name: "M8 Patient portal",
        pricePerMonth: 0,
        sortOrder: 208,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_reschedule",
        name: "M9 Multi-room drag reschedule",
        pricePerMonth: 0,
        sortOrder: 209,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_ehr",
        name: "M10 EHR templates / CPOE lite",
        pricePerMonth: 0,
        sortOrder: 210,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_lis_import",
        name: "M11 LIS analyzer import",
        pricePerMonth: 0,
        sortOrder: 211,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_insurance",
        name: "M12 Insurance / DMS eligibility",
        pricePerMonth: 39,
        sortOrder: 212,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_inpatient",
        name: "M13 Inpatient / bed management",
        pricePerMonth: 19,
        sortOrder: 213,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_telehealth",
        name: "M14 Telehealth + patient portal",
        pricePerMonth: 19,
        sortOrder: 214,
        isPremium: false,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "banking_core",
        name: "Bank Core (kernel)",
        pricePerMonth: 99,
        sortOrder: 120,
        isPremium: false,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_payments",
        name: "Payments hub",
        pricePerMonth: 29,
        sortOrder: 121,
        isPremium: false,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_deposits",
        name: "Deposits",
        pricePerMonth: 19,
        sortOrder: 122,
        isPremium: false,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_loans",
        name: "Lending",
        pricePerMonth: 29,
        sortOrder: 123,
        isPremium: false,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_aml",
        name: "AML / Compliance",
        pricePerMonth: 39,
        sortOrder: 124,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_regreporting",
        name: "Regulatory reporting",
        pricePerMonth: 39,
        sortOrder: 125,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_dbo",
        name: "Digital banking (DBO)",
        pricePerMonth: 19,
        sortOrder: 126,
        isPremium: false,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_cards",
        name: "Cards",
        pricePerMonth: 29,
        sortOrder: 127,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_treasury",
        name: "Treasury / ALM",
        pricePerMonth: 39,
        sortOrder: 128,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_risk",
        name: "Risk management",
        pricePerMonth: 39,
        sortOrder: 129,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_trade",
        name: "Trade finance",
        pricePerMonth: 39,
        sortOrder: 130,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_collections",
        name: "Collections / recovery",
        pricePerMonth: 29,
        sortOrder: 131,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_cash",
        name: "Cash / vault ops",
        pricePerMonth: 19,
        sortOrder: 132,
        isPremium: false,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_islamic",
        name: "Islamic banking window",
        pricePerMonth: 39,
        sortOrder: 133,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_wealth",
        name: "Custody / safekeeping (thin)",
        pricePerMonth: 29,
        sortOrder: 134,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_markets",
        name: "Markets front office (derivatives/bonds)",
        pricePerMonth: 39,
        sortOrder: 135,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_pension",
        name: "Pension / social contributions",
        pricePerMonth: 19,
        sortOrder: 136,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "banking_psa",
        name: "Public sector TSA accounts",
        pricePerMonth: 19,
        sortOrder: 137,
        isPremium: true,
        satelliteKey: "industry_banking",
    },
    {
        key: "fixed_assets",
        name: "Fixed Assets",
        pricePerMonth: 19,
        sortOrder: 5,
        satelliteKey: "finance_core",
        trialEligibleInTrial: true,
    },
    {
        key: "consolidation_pro",
        name: "Holding Consolidation",
        pricePerMonth: 39,
        sortOrder: 16,
        isPremium: false,
        satelliteKey: "finance_core",
    },
    {
        key: "clinic_nurse_roster",
        name: "Nurse roster / procedure post",
        pricePerMonth: 19,
        sortOrder: 215,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_registry_emr",
        name: "EMR / visit protocols",
        pricePerMonth: 29,
        sortOrder: 216,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "clinic_sanatorium_clinical",
        name: "Sanatorium clinical chart",
        pricePerMonth: 29,
        sortOrder: 217,
        satelliteKey: "industry_clinic",
        trialEligibleInTrial: true,
    },
    {
        key: "fnb_kitchen_kds",
        name: "F&B Kitchen KDS",
        pricePerMonth: 19,
        sortOrder: 300,
        satelliteKey: "industry_fnb_pos",
        trialEligibleInTrial: true,
    },
    {
        key: "fnb_waiter_pin",
        name: "F&B waiter PIN / room-charge",
        pricePerMonth: 19,
        sortOrder: 301,
        satelliteKey: "industry_fnb_pos",
        trialEligibleInTrial: true,
    },
    {
        key: "fnb_delivery_hub",
        name: "F&B delivery hub",
        pricePerMonth: 29,
        sortOrder: 302,
        satelliteKey: "industry_fnb_pos",
    },
    {
        key: "fnb_recipes_bom",
        name: "F&B recipes / TTK BOM",
        pricePerMonth: 39,
        sortOrder: 303,
        satelliteKey: "industry_fnb_pos",
    },
    {
        key: "retail_promotions",
        name: "Retail promotions",
        pricePerMonth: 19,
        sortOrder: 310,
        satelliteKey: "industry_retail",
        trialEligibleInTrial: true,
    },
    {
        key: "retail_presets_pack",
        name: "Retail vertical presets",
        pricePerMonth: 29,
        sortOrder: 311,
        satelliteKey: "industry_retail",
    },
    {
        key: "retail_omni_replenish",
        name: "Retail omni replenish",
        pricePerMonth: 39,
        sortOrder: 312,
        satelliteKey: "industry_retail",
    },
    {
        key: "auto_b2b_parts",
        name: "Auto B2B parts procurement",
        pricePerMonth: 19,
        sortOrder: 320,
        satelliteKey: "industry_auto_service",
        trialEligibleInTrial: true,
    },
    {
        key: "auto_norm_tecdoc",
        name: "Auto norms / TecDoc",
        pricePerMonth: 39,
        sortOrder: 321,
        satelliteKey: "industry_auto_service",
    },
    {
        key: "logistics_fuel_waybills",
        name: "Logistics fuel / waybills",
        pricePerMonth: 19,
        sortOrder: 330,
        satelliteKey: "industry_logistics",
        trialEligibleInTrial: true,
    },
    {
        key: "logistics_driver_mobile",
        name: "Logistics driver mobile + POD",
        pricePerMonth: 29,
        sortOrder: 331,
        satelliteKey: "industry_logistics",
    },
    {
        key: "logistics_tariff_matrix",
        name: "Logistics tariff matrix / COD",
        pricePerMonth: 39,
        sortOrder: 332,
        satelliteKey: "industry_logistics",
    },
    {
        key: "construction_daily_logs",
        name: "Construction daily logs / punch list",
        pricePerMonth: 19,
        sortOrder: 340,
        satelliteKey: "industry_construction",
        trialEligibleInTrial: true,
    },
    {
        key: "construction_machinery",
        name: "Construction machinery hours",
        pricePerMonth: 29,
        sortOrder: 341,
        satelliteKey: "industry_construction",
    },
    {
        key: "construction_boq_ks",
        name: "Construction BOQ / KS-2 KS-3",
        pricePerMonth: 39,
        sortOrder: 342,
        satelliteKey: "industry_construction",
    },
    {
        key: "wholesale_credit_limits",
        name: "Wholesale credit-limit display",
        pricePerMonth: 19,
        sortOrder: 350,
        satelliteKey: "industry_wholesale",
        trialEligibleInTrial: true,
    },
    {
        key: "wholesale_pick_pack",
        name: "Wholesale pick / pack / TTN",
        pricePerMonth: 29,
        sortOrder: 351,
        satelliteKey: "industry_wholesale",
    },
    {
        key: "crm_geo_visits",
        name: "CRM geo visits",
        pricePerMonth: 19,
        sortOrder: 360,
        satelliteKey: "industry_crm",
        trialEligibleInTrial: true,
    },
    {
        key: "crm_omni_inbox",
        name: "CRM omni inbox",
        pricePerMonth: 29,
        sortOrder: 361,
        satelliteKey: "industry_crm",
    },
];
async function ensureSatellites(prisma) {
    await prisma.satellite.upsert({
        where: { key: "finance_core" },
        create: {
            key: "finance_core",
            name: "Finance Core",
            verticalSlug: "finance",
            sortOrder: 50,
        },
        update: { name: "Finance Core" },
    });
    const verticalByKey = {
        industry_hotel_pms: "hotel",
        industry_fnb_pos: "fnb",
        industry_retail: "retail",
        industry_logistics: "logistics",
        industry_construction: "construction",
        industry_crm: "crm",
        industry_auto_service: "auto",
        industry_clinic: "clinic",
        industry_wholesale: "wholesale",
        industry_banking: "banking",
    };
    for (const s of INDUSTRY_SATELLITE_SEED) {
        await prisma.satellite.upsert({
            where: { key: s.key },
            create: {
                key: s.key,
                name: s.name,
                verticalSlug: verticalByKey[s.key] ?? s.key.replace("industry_", ""),
                sortOrder: s.sortOrder,
            },
            update: { name: s.name },
        });
    }
}
function moduleSeedData(m) {
    const catalogKind = (0, hotel_module_keys_1.inferPricingCatalogKind)(m.key);
    let satelliteKey = m.satelliteKey ??
        (0, pricing_catalog_canon_1.inferSatelliteKeyFromModuleKey)(m.key);
    if (!satelliteKey && FINANCE_TRIAL_ELIGIBLE.has(m.key)) {
        satelliteKey = "finance_core";
    }
    if (!satelliteKey && (m.key === "nas" || m.key === "consolidation_pro" || m.key === "fixed_assets")) {
        satelliteKey = "finance_core";
    }
    let trialEligibleInTrial = m.trialEligibleInTrial ?? false;
    if (!trialEligibleInTrial) {
        if (FINANCE_TRIAL_ELIGIBLE.has(m.key))
            trialEligibleInTrial = true;
        if (INDUSTRY_TRIAL_ELIGIBLE.has(m.key)) {
            trialEligibleInTrial = true;
        }
        if (m.key === "hotel_core")
            trialEligibleInTrial = true;
        if (m.key === "nas")
            trialEligibleInTrial = true;
    }
    return {
        key: m.key,
        name: m.name,
        pricePerMonth: new client_1.Prisma.Decimal(m.pricePerMonth),
        sortOrder: m.sortOrder,
        isPremium: m.isPremium ?? false,
        catalogKind,
        satelliteKey,
        trialEligibleInTrial,
    };
}
async function seedPricingModuleIfEmpty(prisma) {
    await ensureSatellites(prisma);
    const n = await prisma.pricingModule.count();
    if (n === 0) {
        for (const m of exports.PRICING_MODULE_SEED_DEFAULTS) {
            await prisma.pricingModule.create({ data: moduleSeedData(m) });
        }
        return;
    }
    await ensureMissingPricingModules(prisma);
    await syncPricingModuleCatalog(prisma);
}
async function ensureMissingPricingModules(prisma) {
    await ensureSatellites(prisma);
    for (const m of exports.PRICING_MODULE_SEED_DEFAULTS) {
        const existing = await prisma.pricingModule.findUnique({
            where: { key: m.key },
            select: { id: true },
        });
        if (existing)
            continue;
        try {
            await prisma.pricingModule.create({ data: moduleSeedData(m) });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === "P2002") {
                continue;
            }
            throw e;
        }
    }
}
/** Align existing catalog rows to freeze defaults (price, name, premium, satellite). */
async function syncPricingModuleCatalog(prisma) {
    await ensureSatellites(prisma);
    for (const m of exports.PRICING_MODULE_SEED_DEFAULTS) {
        const data = moduleSeedData(m);
        await prisma.pricingModule.upsert({
            where: { key: m.key },
            create: data,
            update: {
                name: data.name,
                pricePerMonth: data.pricePerMonth,
                sortOrder: data.sortOrder,
                isPremium: data.isPremium,
                catalogKind: data.catalogKind,
                satelliteKey: data.satelliteKey,
                trialEligibleInTrial: data.trialEligibleInTrial,
            },
        });
    }
}
