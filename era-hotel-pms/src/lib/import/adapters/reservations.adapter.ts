import { z } from 'zod';
import { requestOrganizationId } from '@/lib/request-organization';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  cellNumber,
  cellString,
  mapReservationStatus,
  parseDateCell,
} from '@/lib/import/helpers';
import { toDecimal } from '@/lib/decimal';
import type { ImportAdapter } from '@/lib/import/types';
import {
  applyElektrawebSharePair,
  isElektrawebShareSecond,
  parseElektrawebRoomCount,
  physicalRoomNumber,
} from '@/lib/integration/elektraweb-share-map';
import { resolveGuestIdForReservationImport } from '@/lib/import/resolve-reservation-guest';
import { syncReservationPaxFromImport } from '@/lib/import/sync-reservation-pax-import';

const rowSchema = z.object({
  externalRef: z.string().min(1),
  /** Elektraweb Guest Id — stamp via enrich-reservations-guest-id.ts if missing from FO export. */
  guestExternalRef: z.string().optional().nullable(),
  guestName: z.string().optional().nullable(),
  roomTypeCode: z.string().min(1),
  /** Raw EW Room No (may be 707S). */
  roomNumber: z.string().optional().nullable(),
  agencyName: z.string().optional().nullable(),
  checkInDate: z.date(),
  checkOutDate: z.date(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  status: z.string().optional().nullable(),
  voucherNo: z.string().optional().nullable(),
  recordType: z.string().optional().nullable(),
  roomCount: z.number().int().optional().nullable(),
  shareNo: z.string().optional().nullable(),
});

export const reservationsAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'reservations',
  label: 'Reservations',
  order: 11,
  permission: PERMISSIONS.RESERVATIONS_WRITE,
  templateHint:
    '11-Reservations.xlsx — EW FOCP (+ Guest Id enrich). Multi-name `A / B` → ReservationGuest party on one Res Id.',
  headerAliases: {
    'Res Id': 'externalRef',
    'Guest Id': 'guestExternalRef',
    GuestId: 'guestExternalRef',
    GUESTID: 'guestExternalRef',
    'Guest Name': 'guestName',
    'Room Type': 'roomTypeCode',
    'Room No': 'roomNumber',
    Agency: 'agencyName',
    Arrival: 'checkInDate',
    Departure: 'checkOutDate',
    Adult: 'adults',
    TChd: 'children',
    State: 'status',
    Voucher: 'voucherNo',
    'Record Type': 'recordType',
    RECORDTYPE: 'recordType',
    RESTYPE: 'recordType',
    'Room Count': 'roomCount',
    ROOMCOUNT: 'roomCount',
    ROOMCNT: 'roomCount',
    ShareNo: 'shareNo',
    'Share No': 'shareNo',
    SHARENO: 'shareNo',
  },
  rowSchema,
  mapRow: (raw) => {
    const checkIn = parseDateCell(raw.checkInDate);
    const checkOut = parseDateCell(raw.checkOutDate);
    if (!checkIn || !checkOut) throw new Error('Arrival and Departure dates are required');
    return {
      externalRef: cellString(raw.externalRef),
      guestExternalRef: cellString(raw.guestExternalRef),
      guestName: cellString(raw.guestName),
      roomTypeCode: cellString(raw.roomTypeCode),
      roomNumber: cellString(raw.roomNumber),
      agencyName: cellString(raw.agencyName),
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: cellNumber(raw.adults) ?? 1,
      children: cellNumber(raw.children) ?? 0,
      status: cellString(raw.status),
      voucherNo: cellString(raw.voucherNo),
      recordType: cellString(raw.recordType),
      roomCount: parseElektrawebRoomCount(raw.roomCount),
      shareNo: cellString(raw.shareNo),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const roomType = await tx.roomType.findFirst({
      where: {
        OR: [
          { code: row.roomTypeCode.toUpperCase() },
          { name: { equals: row.roomTypeCode, mode: 'insensitive' } },
        ],
      },
    });
    if (!roomType) throw new Error(`Room type not found: ${row.roomTypeCode}`);

    const ratePlan = await tx.ratePlan.findFirst({ where: { active: true }, orderBy: { code: 'asc' } });
    if (!ratePlan) throw new Error('No rate plans — import Rate Codes first');

    let agencyId: string | undefined;
    if (row.agencyName) {
      const agency = await tx.agency.findFirst({
        where: { name: { contains: row.agencyName, mode: 'insensitive' } },
      });
      agencyId = agency?.id;
    }

    const doorNumber = physicalRoomNumber(row.roomNumber);
    let roomId: string | undefined;
    if (doorNumber) {
      const room = await tx.room.findFirst({ where: { roomNumber: doorNumber } });
      roomId = room?.id;
      if (!room && row.roomNumber) {
        // 707S with no master 707 — leave unassigned; share pair skipped later.
        console.warn(
          `[import:reservations] Room ${doorNumber} not found for Res ${row.externalRef} (raw ${row.roomNumber})`,
        );
      }
    }

    const guestId = dryRun
      ? (await tx.guest.findFirst())?.id ?? 'dry-run-guest'
      : await resolveGuestIdForReservationImport(tx, {
          guestExternalRef: row.guestExternalRef,
          guestName: row.guestName,
          reservationExternalRef: row.externalRef,
        });

    const existing = await tx.reservation.findFirst({ where: { externalRef: row.externalRef } });
    const data = {
      organizationId: requestOrganizationId(),
      externalRef: row.externalRef,
      roomTypeId: roomType.id,
      roomId,
      guestId,
      ratePlanId: ratePlan.id,
      agencyId,
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      status: mapReservationStatus(row.status),
      paymentMethod: 'CASH' as const,
      totalAmount: toDecimal(0),
      adults: row.adults ?? 1,
      children11_6: row.children ?? 0,
      voucherNo: row.voucherNo ?? undefined,
      shareNo: row.shareNo ?? undefined,
    };

    if (dryRun) return existing ? 'updated' : 'created';

    const reservation = await tx.reservation.upsert({
      where: { externalRef: row.externalRef } as never,
      create: data,
      update: {
        roomTypeId: data.roomTypeId,
        roomId: data.roomId,
        guestId: data.guestId,
        ratePlanId: data.ratePlanId,
        agencyId: data.agencyId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        status: data.status,
        adults: data.adults,
        children11_6: data.children11_6,
        voucherNo: data.voucherNo,
        shareNo: data.shareNo,
        // Do NOT clear shareEligible / shareGender / shareBedIndex on NORMAL re-import.
      },
    });

    const folios = await tx.folio.findMany({ where: { reservationId: reservation.id } });
    if (folios.length === 0) {
      await tx.folio.create({
        data: {
          organizationId: requestOrganizationId(),
          reservationId: reservation.id,
          type: 'GUEST',
          status: 'OPEN',
        },
      });
    }

    const isSecond = isElektrawebShareSecond({
      rawRoomNumber: row.roomNumber,
      recordType: row.recordType,
      roomCount: row.roomCount,
    });
    const pair = await applyElektrawebSharePair(tx, {
      reservationId: reservation.id,
      isSecond,
      shareNo: row.shareNo,
    });
    if (isSecond && !pair.applied && pair.skippedReason) {
      console.warn(
        `[import:reservations] share pair skipped for ${row.externalRef}: ${pair.skippedReason}`,
      );
    }

    const pax = await syncReservationPaxFromImport(tx, reservation.id, {
      primaryGuestId: guestId,
      guestName: row.guestName,
    });
    if (pax.paxCount > 1) {
      console.info(
        `[import:reservations] Res ${row.externalRef}: ${pax.paxCount} pax (${pax.linkedCount} linked to Guest Cards)`,
      );
    }

    return existing ? 'updated' : 'created';
  },
};
