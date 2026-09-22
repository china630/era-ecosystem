/**
 * Org overlay planning defaults (not satellite db:seed).
 * Run: npx tsx prisma/seed-planning-rules.ts
 */
import { PrismaClient } from "@prisma/client";
import { ensurePlanningDefaults } from "../src/domain/planning/ensure-planning-defaults";

function requireSeedOrgId(): string {
  const id =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (!id || id === "demo-org") {
    throw new Error(
      "ERA_SATELLITE_ORGANIZATION_ID required for seed-planning-rules; demo-org is forbidden",
    );
  }
  return id;
}

const prisma = new PrismaClient();

async function main() {
  const organizationId = requireSeedOrgId();
  const summary = await ensurePlanningDefaults(prisma, organizationId);
  console.log("seed-planning-rules:", JSON.stringify(summary));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
