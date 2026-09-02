import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { assertHotelIdMatches, bridgeRequestOrganizationId } from '@/lib/integration/elektraweb-bridge/config';
import {
  mapElektrawebReservationStatus,
  num,
  parseElektrawebDate,
  str,
} from '@/lib/integration/elektraweb-bridge/normalize';
import { resolveGuestIdForBridgeReservation } from '@/lib/integration/elektraweb-bridge/guest-bridge-resolve';
import type { UpsertResult } from '@/lib/integration/elektraweb-bridge/upsert-guest';
import {
  applyElektrawebSharePair,
  elektrawebShareSignalsFromRow,
  isElektrawebShareSecond,
  physicalRoomNumber,
} from '@/lib/integration/elektraweb-share-map';
import {
  dispatchGuestCheckedIn,
  dispatchGuestCheckedOut,
  dispatchRoomChanged,
  dispatchSanatoriumBookingCreated,
} from '@/lib/integration/guest-lifecycle-events';
import {
  isClinicHttpBridgeEnabled,
  notifyClinicCheckIn,
} from '@/lib/integration/clinic-check-in-bridge';

export type ReservationBridgeResult = UpsertResult & {
  events: string[];
};

async function resolveRatePlanId(row: Record<string, unknown>): Promise<string> {
  const code = str(row.RATECODE) ?? str(row.RATECODEID_RATECODE);
  if (code) {
    const byCode = await prisma.ratePlan.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: 'insensitive' } },
          { name: { equals: code, mode: 'insensitive' } },
        ],
      },
    });
    if (byCode) return byCode.id;
  }
  const any = await prisma.ratePlan.findFirst({ where: { active: true }, orderBy: { code: 'asc' } });
  if (!any) throw new Error('No rate plans — import Rate Codes first');
  return any.id;
}

async function resolveRoomTypeId(row: Record<string, unknown>): Promise<string> {
  const code =
    str(row.ROOMTYPECODE) ??
    str(row.ROOMTYPE) ??
    str(row.ROOMTYPEID_ROOMTYPECODE) ??
    str(row.GIVENROOMTYPEID_ROOMTYPECODE);
  if (!code) throw new Error('Reservation missing room type');
  const roomType = await prisma.roomType.findFirst({
    where: {
      OR: [
        { code: { equals: code, mode: 'insensitive' } },
        { name: { equals: code, mode: 'insensitive' } },
      ],
    },
  });
  if (!roomType) throw new Error(`Room type not found: ${code}`);
  return roomType.id;
}

export async function upsertReservationFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<ReservationBridgeResult> {
  const hotelId = num(row.HOTELID);
  if (hotelId != null) await assertHotelIdMatches(hotelId);

  const externalRef = str(row.RESID) ?? str(row.ID);
  if (!externalRef) throw new Error('Reservation row missing RESID/ID');

  const checkInDate = parseElektrawebDate(row.CHECKIN);
  const checkOutDate = parseElektrawebDate(row.CHECKOUT);
  if (!checkInDate || !checkOutDate) {
    throw new Error(`Reservation ${externalRef} missing CHECKIN/CHECKOUT`);
  }

  const { status } = mapElektrawebReservationStatus(row);
  const rawRoomNumber = str(row.ROOMNO) ?? str(row.ROOMID_ROOMNO);
  const doorNumber = physicalRoomNumber(rawRoomNumber);
  const guestId = await resolveGuestIdForBridgeReservation(row);
  const roomTypeId = await resolveRoomTypeId(row);
  const ratePlanId = await resolveRatePlanId(row);

  let agencyId: string | undefined;
  const agencyName = str(row.AGENCY) ?? str(row.AGENCYID_AGENCYCODE);
  if (agencyName) {
    const agency = await prisma.agency.findFirst({
      where: { name: { contains: agencyName, mode: 'insensitive' } },
    });
    agencyId = agency?.id;
  }

  let roomId: string | undefined;
  if (doorNumber) {
    const room = await prisma.room.findFirst({ where: { roomNumber: doorNumber } });
    roomId = room?.id;
  }

  const shareSignals = elektrawebShareSignalsFromRow({
    ...row,
    rawRoomNumber,
  });
  const shareNo =
    str(row.SHARENO) ?? str(row.SHARE_NO) ?? str(row.ShareNo) ?? undefined;

  const existing = await prisma.reservation.findFirst({
    where: { externalRef },
    include: { room: true, guest: true, ratePlan: true },
  });

  const data = {
    organizationId: bridgeRequestOrganizationId(),
    externalRef,
    roomTypeId,
    roomId,
    guestId,
    ratePlanId,
    agencyId,
    checkInDate,
    checkOutDate,
    status,
    paymentMethod: 'CASH' as const,
    totalAmount: toDecimal(num(row.TOTALPRICE) ?? num(row.MCTOTALPRICE) ?? 0),
    adults: num(row.ADULT) ?? num(row.TOTALADULT) ?? 1,
    children11_6: num(row.TCHD) ?? num(row.TOTALCHILD) ?? 0,
    voucherNo: str(row.VOUCHERNO) ?? undefined,
    shareNo: shareNo ?? undefined,
  };

  const reservation = await prisma.reservation.upsert({
    where: { externalRef } as never,
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
      totalAmount: data.totalAmount,
      shareNo: data.shareNo,
      // Never clear shareEligible when EW flips SHARE → NORMAL after first-out.
    },
    include: { room: true, guest: true, ratePlan: true },
  });

  const folios = await prisma.folio.findMany({ where: { reservationId: reservation.id } });
  if (folios.length === 0) {
    await prisma.folio.create({
      data: {
        organizationId: bridgeRequestOrganizationId(),
        reservationId: reservation.id,
        type: 'GUEST',
        status: 'OPEN',
      },
    });
  }

  const isSecond = isElektrawebShareSecond(shareSignals);
  await applyElektrawebSharePair(prisma, {
    reservationId: reservation.id,
    isSecond,
    shareNo: shareNo ?? null,
  });

  // Live-bridge notes → ReservationNote + medical SKU stamp (Wave A)
  // Align with EW FO-with-Notes columns (all nine note fields).
  const noteFields: Array<[string, string | null | undefined]> = [
    ['EXTRA_REQ', str(row.EXTRAREQ) ?? str(row.EXTRA_REQ) ?? str(row.EXTRAREQUEST)],
    ['RES_NOTE', str(row.RESNOTE) ?? str(row.RES_NOTE) ?? str(row.NOTES)],
    ['CIN_NOTE', str(row.CINNOTE) ?? str(row.CIN_NOTE) ?? str(row.CHECKINNOTE)],
    ['COUT_NOTE', str(row.COUTNOTE) ?? str(row.COUT_NOTE) ?? str(row.CHECKOUTNOTE)],
    ['ROOM_NOTE', str(row.ROOMNOTE) ?? str(row.ROOM_NOTE)],
    ['CANCEL_NOTE', str(row.CANCELNOTE) ?? str(row.CANCEL_NOTE)],
    ['PAYMENT_NOTE', str(row.PAYMENTNOTE) ?? str(row.PAYMENT_NOTE)],
    ['PRICE_NOTE', str(row.PRICENOTE) ?? str(row.PRICE_NOTE)],
    ['INVOICE_NOTE', str(row.INVOICENOTE) ?? str(row.INVOICE_NOTE)],
  ];
  for (const [noteType, text] of noteFields) {
    if (!text?.trim()) continue;
    await prisma.reservationNote.upsert({
      where: {
        reservationId_noteType: {
          reservationId: reservation.id,
          noteType,
        },
      },
      create: { reservationId: reservation.id, noteType, text: text.trim() },
      update: { text: text.trim() },
    });
  }

  const { stampMedicalPackagesForReservation } = await import(
    '@/lib/services/medical-package-stamp.service'
  );
  const stamped = await stampMedicalPackagesForReservation(prisma, reservation.id);
  const programCode = stamped.programCode;

  const events: string[] = [];
  const prevStatus = existing?.status;
  const prevRoom = existing?.room?.roomNumber ?? null;
  const newRoom = reservation.room?.roomNumber ?? doorNumber ?? null;

  if (status === 'IN_HOUSE' && prevStatus !== 'IN_HOUSE') {
    await dispatchGuestCheckedIn({
      reservationId: reservation.id,
      roomNumber: newRoom ?? undefined,
      programCode,
      globalPersonId: reservation.guest.globalPersonId ?? undefined,
      guestName: reservation.guest.fullName,
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString(),
    });
    events.push('GUEST_CHECKED_IN');
    if (isClinicHttpBridgeEnabled()) {
      await notifyClinicCheckIn({
        reservationId: reservation.id,
        guestName: reservation.guest.fullName,
        globalPersonId: reservation.guest.globalPersonId,
      }).catch((e) => console.error('clinic bridge', e));
    }
  } else if (status === 'CONFIRMED' && !existing && programCode) {
    await dispatchSanatoriumBookingCreated({
      reservationId: reservation.id,
      programCode,
      globalPersonId: reservation.guest.globalPersonId ?? undefined,
      guestName: reservation.guest.fullName,
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString(),
    });
    events.push('SANATORIUM_BOOKING_CREATED');
  }

  if (status === 'CHECKED_OUT' && prevStatus !== 'CHECKED_OUT') {
    await dispatchGuestCheckedOut({
      reservationId: reservation.id,
      roomNumber: newRoom ?? undefined,
      programCode,
    });
    events.push('GUEST_CHECKED_OUT');
  }

  if (
    status === 'IN_HOUSE' &&
    prevStatus === 'IN_HOUSE' &&
    prevRoom &&
    newRoom &&
    prevRoom !== newRoom
  ) {
    await dispatchRoomChanged({
      reservationId: reservation.id,
      previousRoomNumber: prevRoom,
      newRoomNumber: newRoom,
      programCode,
    });
    events.push('ROOM_CHANGED');
  }

  return {
    action: existing ? 'updated' : 'created',
    key: externalRef,
    events,
  };
}
