import { prisma } from '@/lib/prisma';
import { civilDay, civilWindow, round2, ymdParam } from '@/lib/reports/civil-days';

export interface FolioTransactionRow {
  id: string;
  time: string;
  businessDate: string;
  folioId: string;
  reservationId: string | null;
  guestName: string | null;
  roomNumber: string | null;
  department: string | null;
  revenueCode: string | null;
  charge: number;
  payment: number;
  /** Running balance inside the folio for the selected period. */
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

const FOLIO_SELECT = {
  select: {
    id: true,
    reservationId: true,
    reservation: {
      select: {
        guest: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
      },
    },
  },
} as const;

export async function queryFolioTransactions(
  fromParam: string | Date,
  toParam: string | Date,
): Promise<FolioTransactionsResult> {
  const from = ymdParam(fromParam);
  const to = ymdParam(toParam) < from ? from : ymdParam(toParam);
  const window = civilWindow(from, to);

  const [charges, payments] = await Promise.all([
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: window.gte, lt: window.lt } },
      select: {
        id: true,
        amount: true,
        description: true,
        businessDate: true,
        createdAt: true,
        department: { select: { name: true } },
        revenueCode: { select: { code: true, department: { select: { name: true } } } },
        folio: FOLIO_SELECT,
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    }),
    prisma.folioPayment.findMany({
      where: { createdAt: { gte: window.gte, lt: window.lt } },
      select: {
        id: true,
        amount: true,
        kind: true,
        paymentMethod: true,
        createdAt: true,
        folio: FOLIO_SELECT,
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    }),
  ]);

  const combined: FolioTransactionRow[] = [
    ...charges.map((c) => ({
      id: c.id,
      time: c.createdAt.toISOString(),
      businessDate: civilDay(c.businessDate),
      folioId: c.folio.id,
      reservationId: c.folio.reservationId,
      guestName: c.folio.reservation?.guest.fullName ?? null,
      roomNumber: c.folio.reservation?.room?.roomNumber ?? null,
      department: c.department?.name ?? c.revenueCode.department?.name ?? null,
      revenueCode: c.revenueCode.code,
      charge: round2(Number(c.amount)),
      payment: 0,
      balance: 0,
      description: c.description,
    })),
    ...payments.map((p) => ({
      id: p.id,
      time: p.createdAt.toISOString(),
      businessDate: civilDay(p.createdAt),
      folioId: p.folio.id,
      reservationId: p.folio.reservationId,
      guestName: p.folio.reservation?.guest.fullName ?? null,
      roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
      department: null,
      revenueCode: null,
      charge: 0,
      payment: round2(p.kind === 'REFUND' ? -Number(p.amount) : Number(p.amount)),
      balance: 0,
      description: `${p.paymentMethod}${p.kind === 'REFUND' ? ' REFUND' : ''}`,
    })),
  ];

  combined.sort(
    (a, b) =>
      (a.roomNumber ?? '').localeCompare(b.roomNumber ?? '', undefined, { numeric: true }) ||
      a.folioId.localeCompare(b.folioId) ||
      a.time.localeCompare(b.time),
  );

  const running = new Map<string, number>();
  const rows = combined.map((row) => {
    const next = round2((running.get(row.folioId) ?? 0) + row.charge - row.payment);
    running.set(row.folioId, next);
    return { ...row, balance: next };
  });

  return {
    from,
    to,
    rows,
    totalCharges: round2(rows.reduce((s, r) => s + r.charge, 0)),
    totalPayments: round2(rows.reduce((s, r) => s + r.payment, 0)),
  };
}
