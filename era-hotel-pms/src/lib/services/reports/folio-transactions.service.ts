import { prisma } from '@/lib/prisma';

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dayEndExclusive(iso: string) {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export interface FolioTransactionRow {
  id: string;
  time: string;
  folioId: string;
  reservationId: string | null;
  guestName: string | null;
  roomNumber: string | null;
  department: string | null;
  charge: number;
  payment: number;
  balance: number;
  description: string;
}

export interface FolioTransactionsResult {
  from: string;
  to: string;
  rows: FolioTransactionRow[];
  totalCharges: number;
  totalPayments: number;
}

export async function queryFolioTransactions(
  fromIso: string,
  toIso: string,
): Promise<FolioTransactionsResult> {
  const from = dayStart(fromIso);
  const to = dayEndExclusive(toIso);

  const [charges, payments] = await Promise.all([
    prisma.folioCharge.findMany({
      where: {
        businessDate: { gte: from, lt: to },
      },
      include: {
        department: { select: { code: true, name: true } },
        folio: {
          select: {
            id: true,
            reservationId: true,
            reservation: {
              select: {
                id: true,
                guest: { select: { fullName: true } },
                room: { select: { roomNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    }),
    prisma.folioPayment.findMany({
      where: {
        createdAt: { gte: from, lt: to },
      },
      include: {
        folio: {
          select: {
            id: true,
            reservationId: true,
            reservation: {
              select: {
                id: true,
                guest: { select: { fullName: true } },
                room: { select: { roomNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    }),
  ]);

  let runningBalance = 0;
  const combined: { time: Date; row: FolioTransactionRow }[] = [];

  for (const c of charges) {
    const amt = Number(c.amount);
    runningBalance += amt;
    combined.push({
      time: c.createdAt,
      row: {
        id: c.id,
        time: c.createdAt.toISOString(),
        folioId: c.folio.id,
        reservationId: c.folio.reservationId,
        guestName: c.folio.reservation?.guest.fullName ?? null,
        roomNumber: c.folio.reservation?.room?.roomNumber ?? null,
        department: c.department?.name ?? null,
        charge: amt,
        payment: 0,
        balance: 0,
        description: c.description,
      },
    });
  }

  for (const p of payments) {
    const amt = Number(p.amount);
    runningBalance -= amt;
    combined.push({
      time: p.createdAt,
      row: {
        id: p.id,
        time: p.createdAt.toISOString(),
        folioId: p.folio.id,
        reservationId: p.folio.reservationId,
        guestName: p.folio.reservation?.guest.fullName ?? null,
        roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
        department: null,
        charge: 0,
        payment: amt,
        balance: 0,
        description: `${p.paymentMethod} ${p.kind}`,
      },
    });
  }

  combined.sort((a, b) => a.time.getTime() - b.time.getTime());

  let balance = 0;
  const rows = combined.map((c) => {
    balance += c.row.charge - c.row.payment;
    return { ...c.row, balance };
  });

  const totalCharges = rows.reduce((s, r) => s + r.charge, 0);
  const totalPayments = rows.reduce((s, r) => s + r.payment, 0);

  return { from: fromIso, to: toIso, rows, totalCharges, totalPayments };
}
