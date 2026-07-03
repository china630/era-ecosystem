/**
 * Report Practitioner rows missing globalPersonId.
 * Usage: npx tsx prisma/scripts/backfill-practitioner-global-person-id.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.practitioner.findMany({
    where: { globalPersonId: null },
    select: { id: true, code: true, fullName: true },
  });

  if (rows.length === 0) {
    console.info("All practitioners have globalPersonId.");
    return;
  }

  console.warn(`Practitioners without globalPersonId: ${rows.length}`);
  for (const row of rows) {
    console.warn(`  ${row.code} — ${row.fullName} (${row.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
