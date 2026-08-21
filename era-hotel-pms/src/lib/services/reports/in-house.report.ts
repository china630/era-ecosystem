import { prisma } from '@/lib/prisma';

export interface InHouseRow {
  reservationId: string;
  roomNumber: string | null;
  guestName: string;
  arrival: string;
  departure: string;
  nights: number;
  rate: number;
  agencyName: string | null;
  segment: string | null;
  vipType: string | null;
  balance: number;
}

export async function queryInHouse(businessDate: Date): Promise<InHouseRow[]> {
  const dateIso = businessDate.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'IN_HOUSE',
      checkInDate: { lt: nextDay },
      checkOutDate: { gt: dayStart },
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
      agency: { select: { name: true } },
      ratePlan: { select: { pricePerNight: true } },
      folios: {
        where: { status: { in: ['OPEN', 'CLOSED'] } },
        select: {
          charges: { select: { amount: true } },
          payments: { select: { amount: true, kind: true } },
        },
      },
    },
    orderBy: { room: { roomNumber: 'asc' } },
  });

  return reservations.map((r) => {
    const arrivalMs = r.checkInDate.getTime();
    const departureMs = r.checkOutDate.getTime();
    const nights = Math.max(1, Math.round((departureMs - arrivalMs) / 86_400_000));

    let totalCharges = 0;
    let totalPayments = 0;
    for (const folio of r.folios) {
      for (const c of folio.charges) totalCharges += Number(c.amount);
      for (const p of folio.payments) {
        if (p.kind === 'PAYMENT') totalPayments += Number(p.amount);
        else totalPayments -= Number(p.amount);
      }
    }
    const balance = Math.round((totalCharges - totalPayments) * 100) / 100;

    return {
      reservationId: r.id,
      roomNumber: r.room?.roomNumber ?? null,
      guestName: r.guest.fullName,
      arrival: r.checkInDate.toISOString().slice(0, 10),
      departure: r.checkOutDate.toISOString().slice(0, 10),
      nights,
      rate: Number(r.ratePlan.pricePerNight),
      agencyName: r.agency?.name ?? null,
      segment: r.segment,
      vipType: r.vipType,
      balance,
    };
  });
}
