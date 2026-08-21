import { prisma } from '@/lib/prisma';

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dayEndExclusive(iso: string) {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export interface CashReportRow {
  id: string;
  time: string;
  guestName: string | null;
  roomNumber: string | null;
  amount: number;
  paymentMethod: string;
  kind: string;
  cashier: string | null;
}

export interface CashReportResult {
  from: string;
  to: string;
  rows: CashReportRow[];
  totalCash: number;
  totalCard: number;
  totalCityLedger: number;
  grandTotal: number;
}

export async function queryCashReport(
  fromIso: string,
  toIso: string,
): Promise<CashReportResult> {
  const from = dayStart(fromIso);
  const to = dayEndExclusive(toIso);

  const payments = await prisma.folioPayment.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      paymentMethod: { in: ['CASH', 'CARD', 'COMPANY_ACCOUNT'] },
    },
    include: {
      folio: {
        select: {
          reservation: {
            select: {
              guest: { select: { fullName: true } },
              room: { select: { roomNumber: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 1000,
  });

  const rows: CashReportRow[] = payments.map((p) => ({
    id: p.id,
    time: p.createdAt.toISOString(),
    guestName: p.folio.reservation?.guest.fullName ?? null,
    roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    kind: p.kind,
    cashier: p.registerRef ?? null,
  }));

  const totalCash = rows.filter((r) => r.paymentMethod === 'CASH').reduce((s, r) => s + r.amount, 0);
  const totalCard = rows.filter((r) => r.paymentMethod === 'CARD').reduce((s, r) => s + r.amount, 0);
  const totalCityLedger = rows.filter((r) => r.paymentMethod === 'COMPANY_ACCOUNT').reduce((s, r) => s + r.amount, 0);
  const grandTotal = totalCash + totalCard + totalCityLedger;

  return { from: fromIso, to: toIso, rows, totalCash, totalCard, totalCityLedger, grandTotal };
}
