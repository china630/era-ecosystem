/**
 * Physio catalog: satellite base templates then Nafta org overlay.
 * Run: npx tsx prisma/seed-physio-catalog.ts
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
import { PrismaClient } from "@prisma/client";
import { requireSeedOrgId, seedPhysioBase, seedPhysioNafta } from "./seed-physio-catalog-lib";

const prisma = new PrismaClient();

async function main() {
  const base = await seedPhysioBase(prisma);
  const organizationId = requireSeedOrgId();
  const nafta = await seedPhysioNafta(prisma, organizationId);
  console.log(JSON.stringify({ organizationId, base, nafta }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
