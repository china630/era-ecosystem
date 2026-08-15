"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedLandingModuleMarketing = seedLandingModuleMarketing;
const landing_modules_1 = require("./landing-modules");
async function seedLandingModuleMarketing(prisma) {
    for (const row of landing_modules_1.LANDING_MODULE_MARKETING_DEFAULTS) {
        await prisma.landingModuleMarketing.upsert({
            where: { moduleSlug: row.moduleSlug },
            create: {
                moduleSlug: row.moduleSlug,
                sortOrder: row.sortOrder,
                names: row.names,
                descriptions: row.descriptions,
                tasks: row.tasks,
            },
            update: {
                sortOrder: row.sortOrder,
                names: row.names,
                descriptions: row.descriptions,
                tasks: row.tasks,
            },
        });
    }
}
