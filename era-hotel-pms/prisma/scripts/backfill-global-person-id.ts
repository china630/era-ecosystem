/**
 * Backfill Guest.globalPersonId via MDM resolve (identity from GuestDocument rows).
 * Run: npx tsx prisma/scripts/backfill-global-person-id.ts
 */
import 'dotenv/config';
import { linkPersonIdentity } from '@era/satellite-kit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIN_DOC_TYPES = new Set(['ID_CARD', 'FIN', 'NATIONAL_ID']);
const PASSPORT_DOC_TYPES = new Set(['PASSPORT']);

function pickDocNumber(
  documents: { docType: string; docNumber: string; isPrimary: boolean }[],
  types: Set<string>,
): string | undefined {
  const match = documents.find((d) => types.has(d.docType) && d.docNumber.trim());
  return match?.docNumber.trim();
}

async function main() {
  const guests = await prisma.guest.findMany({
    where: { globalPersonId: null },
    select: {
      id: true,
      fullName: true,
      phone: true,
      nationality: true,
      documents: {
        select: { docType: true, docNumber: true, isPrimary: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });

  let linked = 0;
  let skipped = 0;
  let failed = 0;
  for (const g of guests) {
    const fin = pickDocNumber(g.documents, FIN_DOC_TYPES);
    const passport = pickDocNumber(g.documents, PASSPORT_DOC_TYPES);
    if (!fin && !passport) {
      skipped++;
      continue;
    }
    try {
      const r = await linkPersonIdentity({
        fin: fin || undefined,
        passport: passport || undefined,
        issuingCountry: g.nationality === 'AZ' ? 'AZ' : undefined,
        fullName: g.fullName,
        phone: g.phone ?? undefined,
        nationality: g.nationality === 'AZ' ? 'AZ' : 'OTHER',
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
