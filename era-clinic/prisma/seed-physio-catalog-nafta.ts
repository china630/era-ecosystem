/**
 * Nafta org overlay physio seed (WO aliases + type gates).
 * Run after base: npx tsx prisma/seed-physio-catalog-nafta.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedPhysioNafta } from "./seed-physio-catalog-lib";

const prisma = new PrismaClient();

seedPhysioNafta(prisma)
  .then((summary) => console.log(JSON.stringify(summary)))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
