/**
 * Satellite base diagnostic catalog seed.
 * Run: node prisma/seed-diagnostic-catalog-base.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { seedDiagnosticBase } = require("./seed-diagnostic-catalog-lib.cjs");

const prisma = new PrismaClient();

seedDiagnosticBase(prisma)
  .then((summary) => {
    console.log(
      "[seed-diagnostic-catalog-base] modalities=" +
        summary.modalities +
        " services=" +
        summary.services +
        " byKind=" +
        JSON.stringify(summary.byKind) +
        " analytes=" +
        summary.analytes +
        " metaFields=" +
        summary.metaFields,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
