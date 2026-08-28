import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { assertHotelIdMatches, bridgeRequestOrganizationId } from '@/lib/integration/elektraweb-bridge/config';
import {
  mapElektrawebReservationStatus,
  num,
  parseElektrawebDate,
  str,
} from '@/lib/integration/elektraweb-bridge/normalize';
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

async function resolveGuestId(row: Record<string, unknown>): Promise<string> {
  const guestExt =
    str(row.RESGUESTID) ??
    str(row.CONTACTGUESTID) ??
    str(row.GUESTID);
  if (guestExt) {
    const byRef = await prisma.guest.findFirst({ where: { externalRef: guestExt } });
    if (byRef) return byRef.id;
    const name =
      str(row.GUESTNAMES) ??
      ([str(row.NAME), str(row.LNAME)].filter(Boolean).join(' ') || `Guest ${guestExt}`);
    const created = await prisma.guest.create({
      data: {
        organizationId: bridgeRequestOrganizationId(),
        externalRef: guestExt,
        fullName: name,
        firstName: str(row.NAME) ?? undefined,
        lastName: str(row.LNAME) ?? undefined,
        phone: str(row.CONTACTPHONE) ?? str(row.PHONE) ?? undefined,
      },
    });
    return created.id;
  }

  const guestName = str(row.GUESTNAMES);
  if (guestName) {
    const byName = await prisma.guest.findFirst({
      where: { fullName: { equals: guestName, mode: 'insensitive' } },
    });
    if (byName) return byName.id;
  }

  const fallback = await prisma.guest.findFirst({ orderBy: { fullName: 'asc' } });
  if (!fallback) throw new Error('No guests in database — sync guests first');
  return fallback.id;
}

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
  const guestId = await resolveGuestId(row);
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

  const events: string[] = [];
  const prevStatus = existing?.status;
  const prevRoom = existing?.room?.roomNumber ?? null;
  const newRoom = reservation.room?.roomNumber ?? doorNumber ?? null;
  const programCode = reservation.ratePlan.medicalFlag
    ? reservation.ratePlan.code
    : undefined;

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
  } else if (
    status === 'CONFIRMED' &&
    !existing &&
    reservation.ratePlan.medicalFlag
  ) {
    await dispatchSanatoriumBookingCreated({
      reservationId: reservation.id,
      programCode: reservation.ratePlan.code,
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
