/**
 * Backfill Guest.globalPersonId via MDM resolve (post #10 when MDM auth failed).
 *
 * Usage (from era-hotel-pms):
 *   ERA_SKIP_TENANT_FILTER=1 npx tsx scripts/ops/backfill-guest-mdm.ts [--dry-run] [--limit=N]
 */
import { resolvePersonIdentity } from '@era/satellite-kit';
import { extractGuestIdentityDocs } from '@/lib/guest-list-identity';
import { prisma } from '@/lib/prisma';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.slice(8), 10) : undefined;

async function main() {
  const guests = await prisma.guest.findMany({
    where: { globalPersonId: null },
    include: { documents: true },
    orderBy: { id: 'asc' },
    ...(limit && Number.isFinite(limit) ? { take: limit } : {}),
  });

  console.log(`Found ${guests.length} guests without globalPersonId (dryRun=${dryRun})`);

  let linked = 0;
  let failed = 0;
  let skipped = 0;

  for (const guest of guests) {
    const { nationalIdFin, passportNumber } = extractGuestIdentityDocs(guest.documents);
    if (!nationalIdFin && !passportNumber && !guest.fullName?.trim()) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      linked += 1;
      continue;
    }

    const resolved = await resolvePersonIdentity({
      fin: nationalIdFin || undefined,
      passport: passportNumber || undefined,
      issuingCountry: guest.nationality || 'AZ',
      firstName: guest.firstName ?? undefined,
      lastName: guest.lastName ?? undefined,
      fullName: guest.fullName,
      phone: guest.phone ?? undefined,
      nationality: guest.nationality || 'AZ',
      sex: guest.sex ?? undefined,
      birthDate: guest.birthDate?.toISOString().slice(0, 10),
    });

    const globalPersonId = resolved.globalPersonId?.trim();
    if (globalPersonId) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { globalPersonId },
      });
      linked += 1;
    } else {
      failed += 1;
    }
  }

  console.log(JSON.stringify({ total: guests.length, linked, failed, skipped, dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
