"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_MODULE_SEED_DEFAULTS = void 0;
exports.seedPricingModuleIfEmpty = seedPricingModuleIfEmpty;
exports.ensureMissingPricingModules = ensureMissingPricingModules;
const client_1 = require("../../generated/client");
const pricing_module_keys_1 = require("./pricing-module-keys");
const hotel_module_keys_1 = require("./hotel-module-keys");
const INDUSTRY_SATELLITE_SEED = [
    { key: "industry_hotel_pms", name: "Hotel PMS", sortOrder: 100, pricePerMonth: 28 },
    { key: "industry_fnb_pos", name: "F&B POS", sortOrder: 101, pricePerMonth: 22 },
    { key: "industry_retail", name: "Retail POS", sortOrder: 102, pricePerMonth: 20 },
    { key: "industry_logistics", name: "Logistics", sortOrder: 103, pricePerMonth: 20 },
    { key: "industry_construction", name: "Construction", sortOrder: 104, pricePerMonth: 20 },
    { key: "industry_crm", name: "CRM Field", sortOrder: 105, pricePerMonth: 18 },
    { key: "industry_auto_service", name: "Auto STO", sortOrder: 106, pricePerMonth: 18 },
    { key: "industry_clinic", name: "Clinic", sortOrder: 107, pricePerMonth: 22 },
    { key: "industry_wholesale", name: "Wholesale", sortOrder: 108, pricePerMonth: 18 },
];
/**
 * Canonical defaults for `pricing_modules` — synced with Super-Admin catalog (2026-05).
 */
exports.PRICING_MODULE_SEED_DEFAULTS = [
    {
        key: pricing_module_keys_1.PRICING_MODULE_CASH_BANK_PRO,
        name: "Cash & Bank Pro",
        pricePerMonth: 38,
        sortOrder: 0,
        isPremium: false,
    },
    { key: "inventory", name: "Warehouse", pricePerMonth: 19, sortOrder: 1 },
    { key: "manufacturing", name: "Manufacturing", pricePerMonth: 19, sortOrder: 2 },
    { key: "hr_full", name: "HR", pricePerMonth: 19, sortOrder: 3 },
    { key: "ifrs_mapping", name: "IFRS", pricePerMonth: 19, sortOrder: 4 },
    { key: "tax_pro", name: "Tax Pro", pricePerMonth: 19, sortOrder: 10, isPremium: true },
    { key: "trade_pro", name: "Trade Pro", pricePerMonth: 19, sortOrder: 11, isPremium: true },
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
        pricePerMonth: 49,
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
        pricePerMonth: 9,
        sortOrder: 21,
        isPremium: true,
    },
    {
        key: "platform_storage",
        name: "Cloud Storage (S3)",
        pricePerMonth: 15,
        sortOrder: 22,
        isPremium: false,
    },
    ...INDUSTRY_SATELLITE_SEED.map((s) => ({
        key: s.key,
        name: s.name,
        pricePerMonth: s.pricePerMonth,
        sortOrder: s.sortOrder,
        isPremium: false,
        satelliteKey: null,
    })),
    // Hotel PMS submodules (9-key taxonomy)
    {
        key: "hotel_core",
        name: "PMS Core (Front Office, Front Cash, Night Audit)",
        pricePerMonth: 24,
        sortOrder: 110,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_housekeeping",
        name: "Housekeeping & Room Rack",
        pricePerMonth: 8,
        sortOrder: 111,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_distribution",
        name: "Distribution (Channel Manager & Contracts)",
        pricePerMonth: 27,
        sortOrder: 112,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_guest_experience",
        name: "Guest Profiles & Tasks",
        pricePerMonth: 10,
        sortOrder: 113,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_spa_scheduling",
        name: "SPA & Procedures",
        pricePerMonth: 10,
        sortOrder: 114,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_transfers",
        name: "Transfers",
        pricePerMonth: 6,
        sortOrder: 115,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_banquets",
        name: "Banquets & BEO",
        pricePerMonth: 10,
        sortOrder: 116,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_medical_sanatorium",
        name: "Medical & Sanatorium",
        pricePerMonth: 14,
        sortOrder: 117,
        isPremium: true,
        satelliteKey: "industry_hotel_pms",
    },
    {
        key: "hotel_setup_advanced",
        name: "Advanced master data",
        pricePerMonth: 5,
        sortOrder: 118,
        isPremium: false,
        satelliteKey: "industry_hotel_pms",
    },
];
async function ensureSatellites(prisma) {
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
    return {
        key: m.key,
        name: m.name,
        pricePerMonth: new client_1.Prisma.Decimal(m.pricePerMonth),
        sortOrder: m.sortOrder,
        isPremium: m.isPremium ?? false,
        catalogKind,
        satelliteKey: m.satelliteKey ?? (m.key.startsWith("hotel_") ? "industry_hotel_pms" : null),
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
}
async function ensureMissingPricingModules(prisma) {
    await ensureSatellites(prisma);
    for (const m of exports.PRICING_MODULE_SEED_DEFAULTS) {
        await prisma.pricingModule.upsert({
            where: { key: m.key },
            create: moduleSeedData(m),
            update: {},
        });
    }
}
