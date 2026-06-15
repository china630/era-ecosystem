/**
 * Backfill Practitioner.globalPersonId via MDM resolve (requires service token).
 * Usage: npx tsx prisma/scripts/backfill-practitioner-global-person-id.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { linkPersonIdentity } from "@era/satellite-kit";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.practitioner.findMany({
    where: { globalPersonId: null },
  });
  let linked = 0;
  for (const row of rows) {
    const result = await linkPersonIdentity({
      fin: row.finCode ?? undefined,
      passport: row.passportNumber ?? undefined,
      issuingCountry: row.issuingCountry ?? undefined,
      fullName: row.fullName,
      phone: row.phone ?? undefined,
    });
    if (result.globalPersonId) {
      await prisma.practitioner.update({
        where: { id: row.id },
        data: { globalPersonId: result.globalPersonId },
      });
      linked++;
    }
  }
  console.info(`Practitioner backfill: ${linked}/${rows.length} linked`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
