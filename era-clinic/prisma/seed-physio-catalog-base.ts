/**
 * Satellite base physio seed (no WO aliases).
 * Run: npx tsx prisma/seed-physio-catalog-base.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedPhysioBase } from "./seed-physio-catalog-lib";

const prisma = new PrismaClient();

seedPhysioBase(prisma)
  .then((summary) => console.log(JSON.stringify(summary)))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
