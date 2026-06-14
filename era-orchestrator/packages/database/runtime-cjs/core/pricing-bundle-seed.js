"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_BUNDLE_SEED_DEFAULTS = void 0;
exports.seedPricingBundleDefaultsIfEmpty = seedPricingBundleDefaultsIfEmpty;
exports.ensureMissingPricingBundles = ensureMissingPricingBundles;
const client_1 = require("../../generated/client");
const pricing_module_keys_1 = require("./pricing-module-keys");
exports.PRICING_BUNDLE_SEED_DEFAULTS = [
    {
        name: "Cash & warehouse",
        discountPercent: 15,
        moduleKeys: [pricing_module_keys_1.PRICING_MODULE_CASH_BANK_PRO, "inventory"],
    },
    {
        name: "HR & IFRS",
        discountPercent: 10,
        moduleKeys: ["hr_full", "ifrs_mapping"],
    },
    {
        name: "Trade & operations",
        discountPercent: 20,
        moduleKeys: ["inventory", "manufacturing"],
    },
    {
        name: "Hotel City",
        discountPercent: 10,
        moduleKeys: ["hotel_core", "hotel_housekeeping", "hotel_migration_pro"],
    },
    {
        name: "Hotel Resort",
        discountPercent: 15,
        moduleKeys: [
            "hotel_core",
            "hotel_housekeeping",
            "hotel_migration_pro",
            "hotel_distribution",
            "hotel_guest_experience",
            "hotel_transfers",
            "hotel_banquets",
            "hotel_spa_scheduling",
        ],
    },
    {
        name: "Hotel Sanatorium",
        discountPercent: 12,
        moduleKeys: [
            "hotel_core",
            "hotel_housekeeping",
            "hotel_migration_pro",
            "hotel_distribution",
            "hotel_guest_experience",
            "hotel_transfers",
            "hotel_banquets",
            "hotel_spa_scheduling",
            "hotel_medical_sanatorium",
        ],
    },
];
async function seedPricingBundleDefaultsIfEmpty(prisma) {
    const n = await prisma.pricingBundle.count();
    if (n === 0) {
        for (const b of exports.PRICING_BUNDLE_SEED_DEFAULTS) {
            await prisma.pricingBundle.create({
                data: {
                    name: b.name,
                    discountPercent: new client_1.Prisma.Decimal(b.discountPercent),
                    moduleKeys: [...b.moduleKeys],
                    isTrialDefault: false,
                },
            });
        }
        return;
    }
    await ensureMissingPricingBundles(prisma);
}
async function ensureMissingPricingBundles(prisma) {
    for (const b of exports.PRICING_BUNDLE_SEED_DEFAULTS) {
        const existing = await prisma.pricingBundle.findFirst({
            where: { name: b.name },
        });
        if (existing) {
            await prisma.pricingBundle.update({
                where: { id: existing.id },
                data: { moduleKeys: [...b.moduleKeys] },
            });
            continue;
        }
        await prisma.pricingBundle.create({
            data: {
                name: b.name,
                discountPercent: new client_1.Prisma.Decimal(b.discountPercent),
                moduleKeys: [...b.moduleKeys],
                isTrialDefault: false,
            },
        });
    }
}
