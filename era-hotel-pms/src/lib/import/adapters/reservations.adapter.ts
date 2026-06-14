import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  cellNumber,
  cellString,
  mapReservationStatus,
  parseDateCell,
} from '@/lib/import/helpers';
import { toDecimal } from '@/lib/decimal';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  externalRef: z.string().min(1),
  guestName: z.string().optional().nullable(),
  roomTypeCode: z.string().min(1),
  roomNumber: z.string().optional().nullable(),
  agencyName: z.string().optional().nullable(),
  checkInDate: z.date(),
  checkOutDate: z.date(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  status: z.string().optional().nullable(),
  voucherNo: z.string().optional().nullable(),
});

async function resolveGuestId(
  tx: Parameters<ImportAdapter<z.infer<typeof rowSchema>>['upsert']>[0],
  guestName: string | null | undefined,
) {
  if (!guestName) {
    const fallback = await tx.guest.findFirst({ orderBy: { fullName: 'asc' } });
    if (!fallback) throw new Error('No guests in database — import Guests first');
    return fallback.id;
  }
  const byName = await tx.guest.findFirst({
    where: {
      OR: [
        { fullName: { equals: guestName, mode: 'insensitive' } },
        { lastName: { equals: guestName, mode: 'insensitive' } },
      ],
    },
  });
  if (byName) return byName.id;
  const created = await tx.guest.create({
    data: {
      fullName: guestName,
      firstName: guestName.split(' ')[0],
      lastName: guestName.split(' ').slice(1).join(' ') || undefined,
      externalRef: `import-guest-${guestName.replace(/\s+/g, '-').slice(0, 40)}`,
    },
  });
  return created.id;
}

export const reservationsAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'reservations',
  label: 'Reservations',
  order: 50,
  permission: PERMISSIONS.RESERVATIONS_WRITE,
  templateHint: 'Reservations.xlsx',
  headerAliases: {
    'Res Id': 'externalRef',
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
  },
  rowSchema,
  mapRow: (raw) => {
    const checkIn = parseDateCell(raw.checkInDate);
    const checkOut = parseDateCell(raw.checkOutDate);
    if (!checkIn || !checkOut) throw new Error('Arrival and Departure dates are required');
    return {
      externalRef: cellString(raw.externalRef),
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

    let roomId: string | undefined;
    if (row.roomNumber) {
      const room = await tx.room.findUnique({ where: { roomNumber: row.roomNumber } });
      roomId = room?.id;
    }

    const guestId = dryRun
      ? (await tx.guest.findFirst())?.id ?? 'dry-run-guest'
      : await resolveGuestId(tx, row.guestName);

    const existing = await tx.reservation.findUnique({ where: { externalRef: row.externalRef } });
    const data = {
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
    };

    if (dryRun) return existing ? 'updated' : 'created';

    const reservation = await tx.reservation.upsert({
      where: { externalRef: row.externalRef },
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
      },
    });

    const folios = await tx.folio.findMany({ where: { reservationId: reservation.id } });
    if (folios.length === 0) {
      await tx.folio.create({
        data: { reservationId: reservation.id, type: 'GUEST', status: 'OPEN' },
      });
    }

    return existing ? 'updated' : 'created';
  },
};
