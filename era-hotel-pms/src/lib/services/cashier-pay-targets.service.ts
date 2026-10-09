import { prisma } from '@/lib/prisma';
import { addHotelDays, stayCheckIn } from '@/lib/hotel-calendar';
import { todayBakuYmd } from '@era/satellite-kit/time';

export type CashierPayTarget = {
  reservationId: string;
  roomNumber: string;
  status: string;
  guests: Array<{ id: string; name: string; isPrimary: boolean; ownsFolio: boolean }>;
};

function personName(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && p.trim()).join(' ').trim();
}

/** In-house stays and today's arrivals, for the header payment modal. */
export async function listCashierPayTargets(q: string): Promise<CashierPayTarget[]> {
  const today = todayBakuYmd();
  const from = stayCheckIn(today);
  const to = stayCheckIn(addHotelDays(today, 1));
  const query = q.trim();

  const stays = await prisma.reservation.findMany({
    where: {
      OR: [
        { status: 'IN_HOUSE' },
        { status: 'CONFIRMED', checkInDate: { gte: from, lt: to } },
      ],
      ...(query
        ? {
            AND: [
              {
                OR: [
                  { room: { roomNumber: { contains: query, mode: 'insensitive' } } },
                  { guest: { fullName: { contains: query, mode: 'insensitive' } } },
                  { guest: { firstName: { contains: query, mode: 'insensitive' } } },
                  { guest: { lastName: { contains: query, mode: 'insensitive' } } },
                  { paxGuests: { some: { firstName: { contains: query, mode: 'insensitive' } } } },
                  { paxGuests: { some: { lastName: { contains: query, mode: 'insensitive' } } } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      room: { select: { roomNumber: true } },
      guest: { select: { fullName: true, firstName: true, lastName: true } },
      paxGuests: {
        select: { id: true, firstName: true, lastName: true, middleName: true, isPrimary: true, ownsFolio: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: [{ room: { roomNumber: 'asc' } }, { checkInDate: 'asc' }],
    take: 25,
  });

  return stays.map((stay) => {
    const fromParty = stay.paxGuests
      .map((g) => ({
        id: g.id,
        name: personName([g.firstName, g.middleName, g.lastName]),
        isPrimary: g.isPrimary,
        ownsFolio: g.ownsFolio,
      }))
      .filter((g) => g.name);
    const guests =
      fromParty.length > 0
        ? fromParty
        : [
            {
              id: 'primary-guest',
              name: personName([stay.guest?.firstName, stay.guest?.lastName]) || stay.guest?.fullName || '',
              isPrimary: true,
              ownsFolio: false,
            },
          ].filter((g) => g.name);
    return {
      reservationId: stay.id,
      roomNumber: stay.room?.roomNumber ?? '—',
      status: stay.status,
      guests,
    };
  });
}
