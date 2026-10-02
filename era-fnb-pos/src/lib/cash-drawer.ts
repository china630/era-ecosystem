import { prisma } from "@/lib/prisma";

export type CashDropView = {
  id: string;
  amountAzn: number;
  note: string | null;
  createdAt: string;
};

export type CashDrawerView = {
  shiftId: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string | null;
  outletCode: string;
  opening: number;
  cashSales: number;
  dropsTotal: number;
  expected: number;
  counted: number | null;
  variance: number | null;
  drops: CashDropView[];
};

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function cashDrawerForShift(shift: {
  id: string;
  outletId: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: { toString(): string } | number;
  countedCash?: { toString(): string } | number | null;
  openedBy: string | null;
  outlet: { code: string };
}): Promise<CashDrawerView> {
  const to = shift.closedAt ?? new Date();
  const [drops, cashTickets] = await Promise.all([
    prisma.posCashDrop.findMany({
      where: { shiftId: shift.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.ticket.findMany({
      where: {
        outletId: shift.outletId,
        status: "CLOSED",
        paymentMethod: "CASH",
        closedAt: { gte: shift.openedAt, lte: new Date(to.getTime() + 1000) },
      },
      select: { totalAzn: true },
    }),
  ]);
  const opening = money(Number(shift.openingCash));
  const cashSales = money(cashTickets.reduce((sum, row) => sum + Number(row.totalAzn), 0));
  const dropViews: CashDropView[] = drops.map((row) => ({
    id: row.id,
    amountAzn: money(Number(row.amountAzn)),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
  const dropsTotal = money(dropViews.reduce((sum, row) => sum + row.amountAzn, 0));
  const expected = money(opening + cashSales - dropsTotal);
  const counted = shift.countedCash == null ? null : money(Number(shift.countedCash));
  return {
    shiftId: shift.id,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    openedBy: shift.openedBy,
    outletCode: shift.outlet.code,
    opening,
    cashSales,
    dropsTotal,
    expected,
    counted,
    variance: counted == null ? null : money(counted - expected),
    drops: dropViews,
  };
}
