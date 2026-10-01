/**
 * Wipe hotel transactional ops for one org (Nafta re-import variant A).
 *
 * Removes guests, reservations, folios, and guest CRM — keeps master data
 * (room types, rooms, agencies, rate plans) and reference seed rows.
 *
 * Usage (staging):
 *   npx tsx scripts/ops/wipe-hotel-ops-transactional.ts --org=<uuid> [--dry-run]
 *   (or ERA_SATELLITE_ORGANIZATION_ID=<uuid> instead of --org)
 *
 * Requires explicit org id (never wipes all tenants). Runs inside that org's
 * tenant context with the kit filter on; explicit org where-clauses stay as a
 * second boundary.
 */
import { isSentinelOrganizationId, runWithSatelliteTenant } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

const dryRun = process.argv.includes('--dry-run');
const orgId =
  process.argv.find((a) => a.startsWith('--org='))?.slice(6)?.trim() ||
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  '';

if (!orgId || isSentinelOrganizationId(orgId)) {
  console.error('Pass --org=<uuid> or set ERA_SATELLITE_ORGANIZATION_ID (real org UUID)');
  process.exit(1);
}

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

runWithSatelliteTenant({ organizationId: orgId }, main)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
