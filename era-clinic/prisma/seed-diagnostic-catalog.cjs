/**
 * Diagnostic catalog: satellite base then Nafta org overlay.
 * Run: node prisma/seed-diagnostic-catalog.cjs
 * ADR: docs/adr/clinic-catalog-base-and-org-overlay-seeds.md
 */
const { PrismaClient } = require("@prisma/client");
const {
  seedOrgId,
  seedDiagnosticBase,
  seedDiagnosticNafta,
} = require("./seed-diagnostic-catalog-lib.cjs");

const prisma = new PrismaClient();

async function main() {
  const organizationId = seedOrgId();
  const base = await seedDiagnosticBase(prisma, organizationId);
  const nafta = await seedDiagnosticNafta(prisma, organizationId);
  console.log(
    "[seed-diagnostic-catalog] org=" +
      organizationId +
      " base.services=" +
      base.services +
      " nafta.packages=" +
      nafta.packages +
      " nafta.patches=" +
      nafta.servicePatches,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
