/**
 * Physio catalog: satellite base then Nafta org overlay.
 * Run: npx tsx prisma/seed-physio-catalog.ts
 * ADR: docs/adr/clinic-catalog-base-and-org-overlay-seeds.md
 */
import { PrismaClient } from "@prisma/client";
import { seedOrgId, seedPhysioBase, seedPhysioNafta } from "./seed-physio-catalog-lib";

const prisma = new PrismaClient();

async function main() {
  const organizationId = seedOrgId();
  const base = await seedPhysioBase(prisma, organizationId);
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
