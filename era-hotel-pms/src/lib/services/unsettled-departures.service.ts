import { prisma } from '@/lib/prisma';
import { folioBalance } from '@/lib/services/folio.service';
import type { CheckoutSettlementStatus, Prisma } from '@prisma/client';

export type UnsettledDepartureRow = {
  reservationId: string;
  checkoutSettlementStatus: CheckoutSettlementStatus;
  guestName: string;
  roomNumber: string | null;
  checkOutDate: string;
  actualCheckOut: string | null;
  agencyName: string | null;
  companyName: string | null;
  agencyId: string | null;
  companyId: string | null;
  payerBalance: number;
  pendingArFolioIds: string[];
  transferredArFolioIds: string[];
};

export async function listUnsettledDepartures(input: {
  from?: string;
  to?: string;
  status?: CheckoutSettlementStatus | 'ALL';
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: UnsettledDepartureRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = [25, 50, 100].includes(input.pageSize ?? 25) ? (input.pageSize ?? 25) : 25;
  const statusFilter =
    input.status && input.status !== 'ALL'
      ? [input.status]
      : (['PENDING', 'INVOICED'] as CheckoutSettlementStatus[]);

  const where: Prisma.ReservationWhereInput = {
    status: 'CHECKED_OUT',
    checkoutSettlementStatus: { in: statusFilter },
  };

  if (input.from || input.to) {
    where.checkOutDate = {};
    if (input.from) where.checkOutDate.gte = new Date(`${input.from}T00:00:00.000Z`);
    if (input.to) where.checkOutDate.lte = new Date(`${input.to}T23:59:59.999Z`);
  }

  const q = input.q?.trim();
  if (q) {
    where.OR = [
      { guest: { fullName: { contains: q, mode: 'insensitive' } } },
      { room: { roomNumber: { contains: q, mode: 'insensitive' } } },
      { agency: { name: { contains: q, mode: 'insensitive' } } },
      { company: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      orderBy: { checkOutDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        guest: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
        agency: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        stay: { select: { actualCheckOut: true } },
        folios: {
          where: {
            type: { in: ['AGENCY', 'COMPANY'] },
            status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] },
          },
          include: { charges: true, payments: true },
        },
      },
    }),
  ]);

  const items: UnsettledDepartureRow[] = rows.map((row) => {
    let payerBalance = 0;
    const pendingArFolioIds: string[] = [];
    const transferredArFolioIds: string[] = [];
    for (const folio of row.folios) {
      payerBalance += folioBalance(folio.charges, folio.payments);
      if (folio.status === 'PENDING_AR') pendingArFolioIds.push(folio.id);
      if (folio.status === 'TRANSFERRED_AR') transferredArFolioIds.push(folio.id);
    }
    return {
      reservationId: row.id,
      checkoutSettlementStatus: row.checkoutSettlementStatus,
      guestName: row.guest.fullName,
      roomNumber: row.room?.roomNumber ?? null,
      checkOutDate: row.checkOutDate.toISOString().slice(0, 10),
      actualCheckOut: row.stay?.actualCheckOut?.toISOString() ?? null,
      agencyName: row.agency?.name ?? null,
      companyName: row.company?.name ?? null,
      agencyId: row.agency?.id ?? null,
      companyId: row.company?.id ?? null,
      payerBalance: Math.round(payerBalance * 100) / 100,
      pendingArFolioIds,
      transferredArFolioIds,
    };
  });

  return { items, total, page, pageSize };
}

export async function maybeMarkReservationSettled(reservationId: string): Promise<void> {
  const openAr = await prisma.folio.count({
    where: {
      reservationId,
      type: { in: ['AGENCY', 'COMPANY'] },
      status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] },
    },
  });
  if (openAr > 0) return;
  await prisma.reservation.updateMany({
    where: {
      id: reservationId,
      checkoutSettlementStatus: { in: ['PENDING', 'INVOICED'] },
    },
    data: { checkoutSettlementStatus: 'SETTLED' },
  });
}
