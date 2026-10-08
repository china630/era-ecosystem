import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { roomInventoryWhere } from '@/lib/master-data/retire-policy';

export type RackReservationSummary = {
  id: string;
  status: string;
  guest: { fullName: string; sex?: string | null };
  checkInDate: string;
  checkOutDate: string;
  payStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NONE';
  procedureCount: number;
  procedurePending: number;
  agencyId: string | null;
  agencyCode: string | null;
  sourceId: string | null;
  sourceCode: string | null;
  shareEligible?: boolean;
  shareGender?: string | null;
  adults?: number;
};

export type RackRoomDto = {
  id: string;
  roomNumber: string;
  status: string;
  hkCondition?: string;
  inventoryStatus?: string;
  floor: number;
  roomTypeId: string;
  roomType: { code: string; name: string; adultCapacity?: number };
  maxBed?: number | null;
  sharePool?: { gender: string; occupied: number; capacity: number } | null;
  reservations: RackReservationSummary[];
};

function resolvePayStatus(balance: number, hasFolio: boolean): RackReservationSummary['payStatus'] {
  if (!hasFolio) return 'NONE';
  if (balance <= 0.01) return 'PAID';
  if (balance > 0) return 'UNPAID';
  return 'PARTIAL';
}

export async function listRoomsForRack(): Promise<RackRoomDto[]> {
  const rooms = await prisma.room.findMany({
    where: roomInventoryWhere,
    orderBy: { roomNumber: 'asc' },
    include: {
      roomType: true,
      reservations: {
        where: { status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] } },
        include: {
          guest: true,
          agency: { select: { id: true, code: true } },
          source: { select: { id: true, code: true } },
          folios: { include: { charges: true, payments: true } },
          medicalOrders: { select: { id: true, status: true } },
          staySlices: { select: { fromDate: true, toDate: true, roomId: true, roomTypeId: true } },
        },
        orderBy: { checkInDate: 'asc' },
      },
    },
  });

  const mapped = rooms.map((room) => {
    const shareStays = room.reservations.filter(
      (r) => r.shareEligible && r.shareGender && r.adults === 1,
    );
    const maxBed = room.maxBed ?? room.roomType.adultCapacity ?? 2;
    const mixedGenders = new Set(
      shareStays.map((s) => s.shareGender).filter(Boolean),
    ).size > 1;
    const sharePool =
      shareStays.length > 0 && !mixedGenders
        ? {
            gender: shareStays[0]!.shareGender!,
            occupied: shareStays.length,
            capacity: maxBed,
          }
        : null;
    return {
      id: room.id,
      roomNumber: room.roomNumber,
      status: room.status,
      hkCondition: room.hkCondition,
      inventoryStatus: room.inventoryStatus,
      floor: room.floor,
      roomTypeId: room.roomTypeId,
      maxBed: room.maxBed,
      sharePool,
      roomType: {
        code: room.roomType.code,
        name: room.roomType.name,
        adultCapacity: room.roomType.adultCapacity,
      },
      reservations: room.reservations.flatMap((r) => {
        let balance = 0;
        for (const f of r.folios) {
          balance += folioBalance(f.charges, f.payments);
        }
        const pending = r.medicalOrders.filter((o) => o.status === 'PENDING').length;
        const summary = {
          id: r.id,
          status: r.status,
          guest: { fullName: r.guest.fullName, sex: r.guest.sex },
          checkInDate: r.checkInDate.toISOString(),
          checkOutDate: r.checkOutDate.toISOString(),
          payStatus: resolvePayStatus(balance, r.folios.length > 0),
          procedureCount: r.medicalOrders.length,
          procedurePending: pending,
          agencyId: r.agencyId,
          agencyCode: r.agency?.code ?? null,
          sourceId: r.sourceId,
          sourceCode: r.source?.code ?? null,
          shareEligible: r.shareEligible,
          shareGender: r.shareGender,
          adults: r.adults,
        };
        const slices = r.staySlices ?? [];
        if (slices.length === 0) return [summary];
        const mine = slices.filter(
          (slice) =>
            slice.roomId === room.id ||
            (!slice.roomId && slice.roomTypeId === r.roomTypeId && r.roomId === room.id),
        );
        if (mine.length === 0) return [];
        return mine.map((slice) => ({
          ...summary,
          checkInDate: slice.fromDate.toISOString(),
          checkOutDate: slice.toDate.toISOString(),
        }));
      }),
    };
  });

  const moved = await prisma.reservationStaySlice.findMany({
    where: {
      roomId: { not: null },
      reservation: { status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] } },
    },
    select: {
      fromDate: true,
      toDate: true,
      roomId: true,
      reservation: {
        select: {
          id: true,
          roomId: true,
          status: true,
          adults: true,
          shareEligible: true,
          shareGender: true,
          agencyId: true,
          sourceId: true,
          guest: { select: { fullName: true, sex: true } },
          agency: { select: { code: true } },
          source: { select: { code: true } },
        },
      },
    },
  });
  for (const slice of moved) {
    if (!slice.roomId || slice.roomId === slice.reservation.roomId) continue;
    const door = mapped.find((room) => room.id === slice.roomId);
    if (!door) continue;
    const checkInDate = slice.fromDate.toISOString();
    if (door.reservations.some((row) => row.id === slice.reservation.id && row.checkInDate === checkInDate)) {
      continue;
    }
    door.reservations.push({
      id: slice.reservation.id,
      status: slice.reservation.status,
      guest: {
        fullName: slice.reservation.guest.fullName,
        sex: slice.reservation.guest.sex,
      },
      checkInDate,
      checkOutDate: slice.toDate.toISOString(),
      payStatus: 'NONE',
      procedureCount: 0,
      procedurePending: 0,
      agencyId: slice.reservation.agencyId,
      agencyCode: slice.reservation.agency?.code ?? null,
      sourceId: slice.reservation.sourceId,
      sourceCode: slice.reservation.source?.code ?? null,
      shareEligible: slice.reservation.shareEligible,
      shareGender: slice.reservation.shareGender,
      adults: slice.reservation.adults,
    });
  }
  return mapped;
}
