/**
 * Diagnostic catalog: satellite base templates then Nafta org overlay.
 * Run: node prisma/seed-diagnostic-catalog.cjs
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
const { PrismaClient } = require("@prisma/client");
const {
  requireSeedOrgId,
  seedDiagnosticBase,
  seedDiagnosticNafta,
} = require("./seed-diagnostic-catalog-lib.cjs");

const prisma = new PrismaClient();

async function main() {
  const base = await seedDiagnosticBase(prisma);
  const organizationId = requireSeedOrgId();
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
