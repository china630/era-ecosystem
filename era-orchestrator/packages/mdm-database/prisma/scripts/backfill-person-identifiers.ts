/**
 * Backfill PersonIdentifier rows from legacy fin_blind_index on GlobalNaturalPerson.
 * Run from era-orchestrator: npx tsx packages/mdm-database/prisma/scripts/backfill-person-identifiers.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/client";

loadEnv({ path: resolve(__dirname, "../../../../.env") });

const url = process.env.MDM_DATABASE_URL;
if (!url) {
  throw new Error("MDM_DATABASE_URL is required");
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const persons = await prisma.globalNaturalPerson.findMany({
    where: { finBlindIndex: { not: null } },
    select: { id: true, finBlindIndex: true, finCipher: true },
  });

  let created = 0;
  for (const p of persons) {
    if (!p.finBlindIndex) continue;
    const exists = await prisma.personIdentifier.findUnique({
      where: {
        type_issuingCountry_blindIndex: {
          type: "AZ_FIN",
          issuingCountry: "AZ",
          blindIndex: p.finBlindIndex,
        },
      },
    });
    if (exists) continue;
    await prisma.personIdentifier.create({
      data: {
        personId: p.id,
        type: "AZ_FIN",
        issuingCountry: "AZ",
        valueCipher: p.finCipher ?? "",
        blindIndex: p.finBlindIndex,
        trust: "SELF_DECLARED",
        isPrimary: true,
      },
    });
    await prisma.globalNaturalPerson.update({
      where: { id: p.id },
      data: { personSegment: "CITIZEN" },
    });
    created++;
  }
  console.log(`Backfilled ${created} AZ_FIN identifier rows (${persons.length} persons scanned)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
