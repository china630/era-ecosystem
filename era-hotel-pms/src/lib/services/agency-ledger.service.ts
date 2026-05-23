import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

export async function listAgencies() {
  return prisma.agency.findMany({ orderBy: { code: 'asc' } });
}

export async function getAgencyLedger(agencyId: string, from: Date, to: Date) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new Error('Agency not found');

  const reservations = await prisma.reservation.findMany({
    where: {
      agencyId,
      OR: [
        { checkInDate: { lte: to }, checkOutDate: { gte: from } },
      ],
    },
    include: {
      folios: {
        include: {
          charges: { include: { revenueCode: true } },
          payments: true,
        },
      },
    },
  });

  let newCharges = 0;
  let payments = 0;

  for (const res of reservations) {
    for (const folio of res.folios) {
      if (folio.type !== 'COMPANY' && folio.type !== 'AGENCY') continue;
      for (const c of folio.charges) {
        const d = c.businessDate;
        if (d >= from && d <= to) {
          newCharges += decimalToNumber(c.amount) * c.qty;
        }
      }
      for (const p of folio.payments) {
        const d = p.createdAt;
        if (d >= from && d <= to) {
          payments += decimalToNumber(p.amount);
        }
      }
    }
  }

  const opening = 0;
  const closing = opening + newCharges - payments;

  return {
    agency,
    opening,
    newCharges,
    payments,
    closing,
    reservationCount: reservations.length,
  };
}
