import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { roomInventoryWhere } from '@/lib/master-data/retire-policy';

export type RackReservationSummary = {
  id: string;
  status: string;
  guest: { fullName: string };
  checkInDate: string;
  checkOutDate: string;
  payStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NONE';
  procedureCount: number;
  procedurePending: number;
  agencyId: string | null;
  agencyCode: string | null;
  sourceId: string | null;
  sourceCode: string | null;
};

export type RackRoomDto = {
  id: string;
  roomNumber: string;
  status: string;
  floor: number;
  roomType: { code: string; name: string };
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
        },
        orderBy: { checkInDate: 'asc' },
      },
    },
  });

  return rooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    status: room.status,
    floor: room.floor,
    roomType: { code: room.roomType.code, name: room.roomType.name },
    reservations: room.reservations.map((r) => {
      let balance = 0;
      for (const f of r.folios) {
        balance += folioBalance(f.charges, f.payments);
      }
      const pending = r.medicalOrders.filter((o) => o.status === 'PENDING').length;
      return {
        id: r.id,
        status: r.status,
        guest: { fullName: r.guest.fullName },
        checkInDate: r.checkInDate.toISOString(),
        checkOutDate: r.checkOutDate.toISOString(),
        payStatus: resolvePayStatus(balance, r.folios.length > 0),
        procedureCount: r.medicalOrders.length,
        procedurePending: pending,
        agencyId: r.agencyId,
        agencyCode: r.agency?.code ?? null,
        sourceId: r.sourceId,
        sourceCode: r.source?.code ?? null,
      };
    }),
  }));
}
