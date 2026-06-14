/**
 * Backfill Guest.globalPersonId via MDM resolve.
 * Run: npx tsx prisma/scripts/backfill-global-person-id.ts
 */
import 'dotenv/config';
import { resolvePersonIdentity } from '@era/satellite-kit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const guests = await prisma.guest.findMany({
    where: { globalPersonId: null },
    select: {
      id: true,
      fullName: true,
      phone: true,
      nationalIdFin: true,
      passportNumber: true,
      nationality: true,
    },
  });

  let linked = 0;
  let skipped = 0;
  let failed = 0;
  for (const g of guests) {
    const fin = g.nationalIdFin?.trim();
    const passport = g.passportNumber?.trim();
    if (!fin && !passport) {
      skipped++;
      continue;
    }
    try {
      const r = await resolvePersonIdentity({
        fin: fin || undefined,
        passport: passport || undefined,
        issuingCountry: g.nationality === 'AZ' ? 'AZ' : undefined,
        fullName: g.fullName,
        phone: g.phone ?? undefined,
        nationality: g.nationality,
      });
      if (!r.globalPersonId) {
        skipped++;
        continue;
      }
      await prisma.guest.update({
        where: { id: g.id },
        data: { globalPersonId: r.globalPersonId },
      });
      linked++;
    } catch (err) {
      failed++;
      console.warn(
        `Skip guest ${g.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.log(
    `Linked ${linked} / ${guests.length} guests (skipped ${skipped}, failed ${failed})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
