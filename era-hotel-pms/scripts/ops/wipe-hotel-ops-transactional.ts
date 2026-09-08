/**
 * Wipe hotel transactional ops for one org (Nafta re-import variant A).
 *
 * Removes guests, reservations, folios, and guest CRM — keeps master data
 * (room types, rooms, agencies, rate plans) and reference seed rows.
 *
 * Usage (staging):
 *   ERA_SKIP_TENANT_FILTER=1 ERA_SATELLITE_ORGANIZATION_ID=<uuid> \
 *     npx tsx scripts/ops/wipe-hotel-ops-transactional.ts [--dry-run]
 *
 * Requires explicit org id (never wipes all tenants).
 */
import { PrismaClient } from '@prisma/client';

const dryRun = process.argv.includes('--dry-run');
const orgId =
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  process.argv.find((a) => a.startsWith('--org='))?.slice(6)?.trim();

if (!orgId) {
  console.error('Set ERA_SATELLITE_ORGANIZATION_ID or pass --org=<uuid>');
  process.exit(1);
}

const prisma = new PrismaClient();

type Counts = Record<string, number>;

async function countFor(label: string, fn: () => Promise<number>): Promise<number> {
  const n = await fn();
  console.log(`${label}: ${n}`);
  return n;
}

async function wipeTransactional(): Promise<Counts> {
  const counts: Counts = {};

  const guestWhere = { organizationId: orgId };
  const resWhere = { organizationId: orgId };

  if (dryRun) {
    counts.medicalAlert = await countFor(
      'MedicalAlert',
      () => prisma.medicalAlert.count({ where: { guest: guestWhere } }),
    );
    counts.reservations = await countFor(
      'Reservation',
      () => prisma.reservation.count({ where: resWhere }),
    );
    counts.guests = await countFor('Guest', () => prisma.guest.count({ where: guestWhere }));
    counts.folios = await countFor(
      'Folio',
      () => prisma.folio.count({ where: { organizationId: orgId } }),
    );
    counts.elektrawebOutbox = await countFor(
      'ElektrawebFolioOutbox',
      () => prisma.elektrawebFolioOutbox.count({ where: { organizationId: orgId } }),
    );
    return counts;
  }

  await prisma.$transaction(async (tx) => {
    await tx.medicalAlert.deleteMany({ where: { guest: guestWhere } });

    await tx.folioPayment.deleteMany({ where: { folio: { organizationId: orgId } } });
    await tx.folioCharge.deleteMany({ where: { folio: { organizationId: orgId } } });
    await tx.folioSettlement.deleteMany({ where: { folio: { organizationId: orgId } } });
    await tx.folioDeposit.deleteMany({ where: { folio: { organizationId: orgId } } });
    await tx.fiscalDocument.deleteMany({ where: { reservation: resWhere } });
    await tx.folio.deleteMany({ where: { organizationId: orgId } });

    await tx.stay.deleteMany({ where: { reservation: resWhere } });
    await tx.reservationDailyRate.deleteMany({ where: { reservation: resWhere } });
    await tx.reservationGuest.deleteMany({ where: { reservation: resWhere } });
    await tx.reservationNote.deleteMany({ where: { reservation: resWhere } });
    await tx.reservationAttachment.deleteMany({ where: { reservation: resWhere } }).catch(() => {});
    await tx.reservation.deleteMany({ where: resWhere });

    await tx.elektrawebFolioOutbox.deleteMany({ where: { organizationId: orgId } });

    counts.guests = (await tx.guest.deleteMany({ where: guestWhere })).count;

    await tx.room.updateMany({
      where: { organizationId: orgId, deleted: false },
      data: { status: 'AVAILABLE' },
    });
  });

  counts.reservations = 0;
  counts.guests = counts.guests ?? 0;
  console.log(`Deleted guests: ${counts.guests}`);
  console.log('Reservations/folios cleared; rooms set AVAILABLE');
  return counts;
}

async function main() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Wipe hotel transactional ops org=${orgId}`);
  await wipeTransactional();
  const remaining = await prisma.guest.count({ where: { organizationId: orgId } });
  console.log(`Guest rows remaining: ${remaining}`);
  if (!dryRun && remaining > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
