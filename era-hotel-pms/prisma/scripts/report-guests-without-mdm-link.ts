/**
 * Report guests that still have local identity columns but no globalPersonId.
 * Run before W4 migration DROP: npx tsx prisma/scripts/report-guests-without-mdm-link.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      fullName: string;
      nationalIdFin: string | null;
      passportNumber: string | null;
      globalPersonId: string | null;
    }>
  >`
    SELECT id, "fullName", "nationalIdFin", "passportNumber", "globalPersonId"
    FROM "Guest"
    WHERE "globalPersonId" IS NULL
      AND ("nationalIdFin" IS NOT NULL OR "passportNumber" IS NOT NULL)
    ORDER BY "fullName"
  `;

  const header = 'id,fullName,nationalIdFin,passportNumber,globalPersonId';
  const lines = rows.map(
    (r) =>
      `${r.id},"${r.fullName.replace(/"/g, '""')}",${r.nationalIdFin ?? ''},${r.passportNumber ?? ''},`,
  );
  const csv = [header, ...lines].join('\n');
  const outPath = 'tmp/guests-without-mdm-link.csv';
  writeFileSync(outPath, csv, 'utf8');
  console.log(`Blockers: ${rows.length} guests written to ${outPath}`);
  if (rows.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
