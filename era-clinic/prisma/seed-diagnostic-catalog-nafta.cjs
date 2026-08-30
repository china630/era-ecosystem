/**
 * Nafta org overlay diagnostic seed (PKG-NAFTA-INTAKE + USG patches).
 * Run after base: node prisma/seed-diagnostic-catalog-nafta.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { seedDiagnosticNafta } = require("./seed-diagnostic-catalog-lib.cjs");

const prisma = new PrismaClient();

seedDiagnosticNafta(prisma)
  .then((summary) => {
    console.log("[seed-diagnostic-catalog-nafta]", JSON.stringify(summary));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
