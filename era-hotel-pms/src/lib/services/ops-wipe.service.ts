import { isSentinelOrganizationId } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

/**
 * Operational wipe for one hotel org: guests, reservations, folios, notes, concierge and banquet orders,
 * plus rows that cascade from them (procedures, lab results, tours, transfers, migration and tourism filings).
 * Master data (room types, rooms, rates, revenue codes, agencies, lookups) stays. Finance and MDM are
 * separate services and are not touched. Every where-clause carries the org id as a second boundary
 * on top of the tenant extension.
 */

export type OpsWipeCounts = {
  guests: number;
  reservations: number;
  folios: number;
  folioCharges: number;
  folioPayments: number;
  reservationNotes: number;
  guestNotes: number;
  conciergeOrders: number;
  banquetEvents: number;
  medicalOrders: number;
  medicalAlerts: number;
  elektrawebOutbox: number;
  /** Removed by cascade from reservations / guests / medical orders. */
  procedureAppointments: number;
  labResults: number;
  tourBookings: number;
  transferOrders: number;
  migrationRegistrations: number;
  tourismSubmissions: number;
};

function assertOrg(organizationId: string): string {
  const org = organizationId.trim();
  if (!org || isSentinelOrganizationId(org)) {
    throw Object.assign(new Error('Ops wipe requires a real organization id'), { status: 400 });
  }
  return org;
}

export async function countOpsWipe(organizationId: string): Promise<OpsWipeCounts> {
  const org = assertOrg(organizationId);
  const byOrg = { organizationId: org };
  const [
    guests,
    reservations,
    folios,
    folioCharges,
    folioPayments,
    reservationNotes,
    guestNotes,
    conciergeOrders,
    banquetEvents,
    medicalOrders,
    medicalAlerts,
    elektrawebOutbox,
    procedureAppointments,
    labResults,
    tourBookings,
    transferOrders,
    migrationRegistrations,
    tourismSubmissions,
  ] = await Promise.all([
    prisma.guest.count({ where: byOrg }),
    prisma.reservation.count({ where: byOrg }),
    prisma.folio.count({ where: byOrg }),
    prisma.folioCharge.count({ where: { folio: byOrg } }),
    prisma.folioPayment.count({ where: { folio: byOrg } }),
    prisma.reservationNote.count({ where: byOrg }),
    prisma.guestNote.count({ where: byOrg }),
    prisma.conciergeOrder.count({ where: byOrg }),
    prisma.banquetEvent.count({ where: byOrg }),
    prisma.medicalOrder.count({ where: byOrg }),
    prisma.medicalAlert.count({ where: byOrg }),
    prisma.elektrawebFolioOutbox.count({ where: byOrg }),
    prisma.procedureAppointment.count({ where: byOrg }),
    prisma.labResult.count({ where: byOrg }),
    prisma.tourBooking.count({ where: byOrg }),
    prisma.transferOrder.count({ where: byOrg }),
    prisma.migrationRegistration.count({ where: byOrg }),
    prisma.tourismSubmission.count({ where: byOrg }),
  ]);
  return {
    guests,
    reservations,
    folios,
    folioCharges,
    folioPayments,
    reservationNotes,
    guestNotes,
    conciergeOrders,
    banquetEvents,
    medicalOrders,
    medicalAlerts,
    elektrawebOutbox,
    procedureAppointments,
    labResults,
    tourBookings,
    transferOrders,
    migrationRegistrations,
    tourismSubmissions,
  };
}

/** Deletes the operational bucket in FK-safe order inside one transaction; returns the pre-wipe counts. */
export async function runOpsWipe(organizationId: string): Promise<OpsWipeCounts> {
  const org = assertOrg(organizationId);
  const before = await countOpsWipe(org);
  const byOrg = { organizationId: org };

  await prisma.$transaction(
    async (tx) => {
      await tx.medicalAlert.deleteMany({ where: byOrg });
      await tx.medicalOrder.deleteMany({ where: byOrg });
      await tx.conciergeOrder.deleteMany({ where: byOrg });
      await tx.banquetEvent.deleteMany({ where: byOrg });

      await tx.folioPayment.deleteMany({ where: { folio: byOrg } });
      await tx.folioCharge.deleteMany({ where: { folio: byOrg } });
      await tx.folioSettlement.deleteMany({ where: { folio: byOrg } });
      await tx.folioDeposit.deleteMany({ where: { reservation: byOrg } });
      await tx.fiscalDocument.deleteMany({ where: { reservation: byOrg } });
      await tx.folio.deleteMany({ where: byOrg });

      await tx.stay.deleteMany({ where: { reservation: byOrg } });
      await tx.reservationDailyRate.deleteMany({ where: { reservation: byOrg } });
      await tx.reservationGuest.deleteMany({ where: { reservation: byOrg } });
      await tx.reservationNote.deleteMany({ where: byOrg });
      await tx.reservation.deleteMany({ where: byOrg });

      await tx.elektrawebFolioOutbox.deleteMany({ where: byOrg });
      await tx.guest.deleteMany({ where: byOrg });

      await tx.room.updateMany({
        where: { organizationId: org, deleted: false },
        data: { status: 'AVAILABLE' },
      });
    },
    { maxWait: 10_000, timeout: 180_000 },
  );

  return before;
}
