/**
 * Verify Guest table has no plaintext identity columns (post-W4 migration).
 * Dry-run before migration reports column presence via information_schema.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Guest'
      AND column_name IN ('nationalIdFin', 'passportNumber')
  `;

  if (cols.length === 0) {
    console.log('OK: Guest has no nationalIdFin/passportNumber columns');
    return;
  }

  console.log(
    `WARN: identity columns still present: ${cols.map((c) => c.column_name).join(', ')}`,
  );
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
