import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";
import { daySeqMap } from "@/lib/ticket-helpers";
import { requestOrganizationId } from "@/lib/request-organization";

export type SaleRow = {
  id: string;
  dayNo: number | null;
  closedAt: string;
  place: string;
  method: string | null;
  totalAzn: number;
};

export type SaleTotals = {
  cash: number;
  card: number;
  transfer: number;
  other: number;
  count: number;
  sum: number;
};

export type SaleShift = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string | null;
  outletCode: string;
};

export type SaleReport = {
  rows: SaleRow[];
  totals: SaleTotals;
  shift: SaleShift | null;
};

function placeOf(ticket: {
  serviceChannel: string | null;
  walkInLabel: string | null;
  table: { code: string } | null;
}): string {
  if (ticket.table?.code) return ticket.table.code;
  if (ticket.serviceChannel === "TAKEAWAY") return ticket.walkInLabel?.trim() || "TAKEAWAY";
  return ticket.walkInLabel?.trim() || ticket.serviceChannel || "";
}

function totalsOf(rows: SaleRow[]): SaleTotals {
  const totals: SaleTotals = {
    cash: 0,
    card: 0,
    transfer: 0,
    other: 0,
    count: rows.length,
    sum: 0,
  };
  for (const row of rows) {
    totals.sum += row.totalAzn;
    const method = (row.method ?? "").toUpperCase();
    if (method === "CASH") totals.cash += row.totalAzn;
    else if (method === "CARD") totals.card += row.totalAzn;
    else if (method === "TRANSFER") totals.transfer += row.totalAzn;
    else totals.other += row.totalAzn;
  }
  totals.sum = Math.round(totals.sum * 100) / 100;
  totals.cash = Math.round(totals.cash * 100) / 100;
  totals.card = Math.round(totals.card * 100) / 100;
  totals.transfer = Math.round(totals.transfer * 100) / 100;
  totals.other = Math.round(totals.other * 100) / 100;
  return totals;
}

export async function saleReportBetween(input: {
  from: Date;
  to: Date;
  outletId?: string;
  shift?: SaleShift | null;
  channel?: "TAKEAWAY" | "DINE_IN";
  method?: "CASH" | "CARD" | "TRANSFER";
}): Promise<SaleReport> {
  const organizationId = requestOrganizationId();
  const tickets = await prisma.ticket.findMany({
    where: {
      status: "CLOSED",
      closedAt: { gte: input.from, lte: input.to },
      ...(input.outletId ? { outletId: input.outletId } : {}),
      ...(input.channel === "TAKEAWAY" ? { serviceChannel: "TAKEAWAY" } : {}),
      ...(input.channel === "DINE_IN"
        ? { OR: [{ serviceChannel: null }, { serviceChannel: { not: "TAKEAWAY" } }] }
        : {}),
      ...(input.method ? { paymentMethod: input.method } : {}),
    },
    include: { table: { select: { code: true } } },
    orderBy: { closedAt: "desc" },
    take: 300,
  });
  const dayNos = await daySeqMap(organizationId);
  const rows: SaleRow[] = tickets.map((ticket) => ({
    id: ticket.id,
    dayNo: dayNos.get(ticket.id) ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? "",
    place: placeOf(ticket),
    method: ticket.paymentMethod,
    totalAzn: Number(ticket.totalAzn),
  }));
  return { rows, totals: totalsOf(rows), shift: input.shift ?? null };
}

export async function saleReportForScope(
  scope: "today" | "shift",
  filters?: {
    date?: string;
    channel?: "TAKEAWAY" | "DINE_IN";
    method?: "CASH" | "CARD" | "TRANSFER";
  },
): Promise<SaleReport> {
  const channel = filters?.channel;
  const method = filters?.method;
  if (scope === "shift") {
    const shift = await prisma.posShift.findFirst({
      where: { status: "OPEN" },
      include: { outlet: true },
      orderBy: { openedAt: "desc" },
    });
    if (!shift) {
      return { rows: [], totals: totalsOf([]), shift: null };
    }
    return saleReportBetween({
      from: shift.openedAt,
      to: new Date(),
      outletId: shift.outletId,
      channel,
      method,
      shift: {
        id: shift.id,
        openedAt: shift.openedAt.toISOString(),
        closedAt: null,
        openedBy: shift.openedBy,
        outletCode: shift.outlet.code,
      },
    });
  }
  const day = filters?.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date) ? filters.date : todayBakuYmd();
  const { start, end } = bakuDayBounds(day);
  return saleReportBetween({ from: start, to: end, channel, method });
}

export async function saleReportForShift(shiftId: string): Promise<SaleReport> {
  const shift = await prisma.posShift.findUnique({
    where: { id: shiftId },
    include: { outlet: true },
  });
  if (!shift) return { rows: [], totals: totalsOf([]), shift: null };
  const to = shift.closedAt ?? new Date();
  return saleReportBetween({
    from: shift.openedAt,
    to: new Date(to.getTime() + 1000),
    outletId: shift.outletId,
    shift: {
      id: shift.id,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      openedBy: shift.openedBy,
      outletCode: shift.outlet.code,
    },
  });
}
