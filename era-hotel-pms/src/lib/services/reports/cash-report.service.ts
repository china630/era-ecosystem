import { prisma } from '@/lib/prisma';
import { civilWindow, round2, ymdParam } from '@/lib/reports/civil-days';

export interface CashReportRow {
  id: string;
  time: string;
  guestName: string | null;
  roomNumber: string | null;
  /** Refunds are negative. */
  amount: number;
  paymentMethod: string;
  kind: string;
  cashier: string | null;
  reference: string | null;
}

export interface CashReportResult {
  from: string;
  to: string;
  rows: CashReportRow[];
  byMethod: { method: string; count: number; amount: number }[];
  grandTotal: number;
}

export async function queryCashReport(fromParam: string | Date, toParam: string | Date): Promise<CashReportResult> {
  const from = ymdParam(fromParam);
  const to = ymdParam(toParam) < from ? from : ymdParam(toParam);
  const window = civilWindow(from, to);

  const payments = await prisma.folioPayment.findMany({
    where: { createdAt: { gte: window.gte, lt: window.lt } },
    select: {
      id: true,
      createdAt: true,
      amount: true,
      kind: true,
      paymentMethod: true,
      registerRef: true,
      bankReference: true,
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
    take: 5000,
  });

  const rows: CashReportRow[] = payments.map((p) => ({
    id: p.id,
    time: p.createdAt.toISOString(),
    guestName: p.folio.reservation?.guest.fullName ?? null,
    roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
    amount: round2(p.kind === 'REFUND' ? -Number(p.amount) : Number(p.amount)),
    paymentMethod: p.paymentMethod,
    kind: p.kind,
    cashier: p.registerRef ?? null,
    reference: p.bankReference ?? null,
  }));

  const methodMap = new Map<string, { method: string; count: number; amount: number }>();
  for (const r of rows) {
    const m = methodMap.get(r.paymentMethod) ?? { method: r.paymentMethod, count: 0, amount: 0 };
    m.count += 1;
    m.amount += r.amount;
    methodMap.set(r.paymentMethod, m);
  }
  const byMethod = [...methodMap.values()]
    .map((m) => ({ ...m, amount: round2(m.amount) }))
    .sort((a, b) => a.method.localeCompare(b.method));

  return { from, to, rows, byMethod, grandTotal: round2(byMethod.reduce((s, m) => s + m.amount, 0)) };
}
