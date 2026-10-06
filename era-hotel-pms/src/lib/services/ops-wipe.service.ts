import { isSentinelOrganizationId } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import {
  normalizeWipeSelection,
  OPS_WIPE_KEYS,
  type OpsWipeKey,
} from '@/lib/ops-wipe-selection';

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

export type OpsWipeResult = {
  before: OpsWipeCounts;
  deletedKeys: OpsWipeKey[];
};

/**
 * Deletes the chosen operational keys for one org. Omitted selection wipes every ops key.
 * A parent is skipped when a child that references it is not selected.
 * Rows with no checkbox (settlements, deposits, stays, party, POS bookings, channel errors)
 * go with the folio or reservation they hang on. Loose ids that are not foreign keys
 * (concierge and laundry charge, tour payment, banquet master folio, card-auth folio,
 * migration registration's reservation id) are cleared when that target is wiped. Master data stays.
 */
export async function runOpsWipe(
  organizationId: string,
  selection?: { ops?: string[] },
): Promise<OpsWipeResult> {
  const org = assertOrg(organizationId);
  const chosen = new Set(normalizeWipeSelection(selection?.ops ?? [...OPS_WIPE_KEYS]));
  const before = await countOpsWipe(org);
  const byOrg = { organizationId: org };
  const has = (key: OpsWipeKey) => chosen.has(key);

  await prisma.$transaction(
    async (tx) => {
      if (has('labResults')) await tx.labResult.deleteMany({ where: byOrg });
      if (has('medicalOrders')) await tx.medicalOrder.deleteMany({ where: byOrg });
      if (has('medicalAlerts')) await tx.medicalAlert.deleteMany({ where: byOrg });
      if (has('conciergeOrders')) await tx.conciergeOrder.deleteMany({ where: byOrg });
      if (has('banquetEvents')) await tx.banquetEvent.deleteMany({ where: byOrg });

      if (has('folioPayments')) {
        await tx.tourBooking.updateMany({
          where: { ...byOrg, folioPaymentId: { not: null } },
          data: { folioPaymentId: null },
        });
        await tx.folioPayment.deleteMany({ where: { folio: byOrg } });
      }
      if (has('folioCharges')) {
        await tx.conciergeOrder.updateMany({
          where: { ...byOrg, folioChargeId: { not: null } },
          data: { folioChargeId: null },
        });
        await tx.laundryTicket.updateMany({
          where: { ...byOrg, folioChargeId: { not: null } },
          data: { folioChargeId: null },
        });
        await tx.posRoomChargeIdempotency.deleteMany({ where: byOrg });
        await tx.folioCharge.deleteMany({ where: { folio: byOrg } });
      }
      if (has('folios')) {
        await tx.banquetEvent.updateMany({
          where: { ...byOrg, masterFolioId: { not: null } },
          data: { masterFolioId: null },
        });
        await tx.cardAuthorization.updateMany({
          where: { ...byOrg, folioId: { not: null } },
          data: { folioId: null },
        });
        await tx.folioSettlement.deleteMany({ where: { folio: byOrg } });
        await tx.folio.deleteMany({ where: byOrg });
      }

      if (has('procedureAppointments')) await tx.procedureAppointment.deleteMany({ where: byOrg });
      if (has('tourBookings')) await tx.tourBooking.deleteMany({ where: byOrg });
      if (has('transferOrders')) await tx.transferOrder.deleteMany({ where: byOrg });
      if (has('tourismSubmissions')) await tx.tourismSubmission.deleteMany({ where: byOrg });
      if (has('reservationNotes')) await tx.reservationNote.deleteMany({ where: byOrg });
      if (has('migrationRegistrations')) await tx.migrationRegistration.deleteMany({ where: byOrg });

      if (has('reservations')) {
        await tx.migrationRegistration.updateMany({
          where: { ...byOrg, reservationId: { not: null } },
          data: { reservationId: null },
        });
        await tx.folioDeposit.deleteMany({ where: { reservation: byOrg } });
        await tx.fiscalDocument.deleteMany({ where: { reservation: byOrg } });
        await tx.channelSyncError.deleteMany({ where: { ...byOrg, reservationId: { not: null } } });
        await tx.posReservation.deleteMany({ where: { ...byOrg, reservationId: { not: null } } });
        await tx.stay.deleteMany({ where: { reservation: byOrg } });
        await tx.reservationDailyRate.deleteMany({ where: { reservation: byOrg } });
        await tx.reservationGuest.deleteMany({ where: { reservation: byOrg } });
        await tx.reservation.deleteMany({ where: byOrg });
        await tx.room.updateMany({
          where: { organizationId: org, deleted: false },
          data: { status: 'AVAILABLE' },
        });
      }

      if (has('guestNotes')) await tx.guestNote.deleteMany({ where: byOrg });
      if (has('elektrawebOutbox')) await tx.elektrawebFolioOutbox.deleteMany({ where: byOrg });
      if (has('guests')) await tx.guest.deleteMany({ where: byOrg });
    },
    { maxWait: 10_000, timeout: 180_000 },
  );

  return { before, deletedKeys: [...chosen] };
}
