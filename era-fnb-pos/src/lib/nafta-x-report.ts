import { bakuDayBounds } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";

export const X_REPORT_BLOCKS = [
  "checks",
  "groups",
  "waiters",
  "cashiers",
  "discount",
  "dishes",
  "payments",
  "openCash",
] as const;

export type XReportBlock = (typeof X_REPORT_BLOCKS)[number];

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function hiddenSet(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((x) => typeof x === "string"));
}

type ClosedRow = {
  id: string;
  totalAzn: { toString(): string };
  discountPercent: { toString(): string };
  subtotalAzn: { toString(): string };
  paymentMethod: string | null;
  tenderRoute: string | null;
  cardTerminalLabel: string | null;
  limitHolderId: string | null;
  roomNumberLabel: string | null;
  roomChargeReservationId: string | null;
  guestName: string | null;
  waiterLabel: string | null;
  openedByName: string | null;
  closedByName: string | null;
  covers: number;
  lines: { description: string; qty: number; unitPriceAzn: { toString(): string }; kitchenStatus: string; menuItem: { category: { name: string; revenueCode: string | null } | null } | null }[];
};

function routeOf(row: ClosedRow): string {
  if (row.tenderRoute) return row.tenderRoute;
  if (row.roomChargeReservationId || row.roomNumberLabel) return "ROOM";
  return (row.paymentMethod ?? "UNKNOWN").toUpperCase();
}

export async function buildXReport(outletId: string, ymd: string) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) return null;
  const { start, end } = bakuDayBounds(ymd);
  const hidden = hiddenSet(outlet.xReportHidden);
  const closed = await prisma.ticket.findMany({
    where: { outletId, status: "CLOSED", closedAt: { gte: start, lt: end } },
    include: {
      lines: {
        include: { menuItem: { include: { category: true } } },
      },
    },
  });
  const open = await prisma.ticket.findMany({
    where: { outletId, status: { in: ["OPEN", "HELD"] } },
    select: { id: true, totalAzn: true, tableId: true, openedAt: true, waiterLabel: true },
  });

  const rows = closed as unknown as ClosedRow[];
  let sales = 0;
  let discount = 0;
  const groups = new Map<string, { count: number; total: number }>();
  const dishes = new Map<string, { qty: number; total: number }>();
  const waiters = new Map<string, { count: number; total: number }>();
  const cashiers = new Map<string, { count: number; total: number }>();
  const payments = new Map<string, { total: number; lines: { label: string; total: number; ticketId: string }[] }>();

  for (const row of rows) {
    const total = Number(row.totalAzn);
    sales += total;
    const sub = Number(row.subtotalAzn);
    if (sub > total) discount += sub - total;
    const waiter = row.waiterLabel || row.openedByName || "—";
    const cashier = row.closedByName || "—";
    const w = waiters.get(waiter) ?? { count: 0, total: 0 };
    w.count += 1;
    w.total += total;
    waiters.set(waiter, w);
    const c = cashiers.get(cashier) ?? { count: 0, total: 0 };
    c.count += 1;
    c.total += total;
    cashiers.set(cashier, c);

    const route = routeOf(row);
    let bucket = route;
    let detail = row.id.slice(0, 8);
    if (route === "CARD") {
      bucket = `CARD:${row.cardTerminalLabel || "CARD"}`;
      detail = row.cardTerminalLabel || "CARD";
    } else if (route === "LIMIT") {
      bucket = `LIMIT:${row.limitHolderId || "limit"}`;
      detail = row.limitHolderId || "limit";
    } else if (route === "ROOM") {
      bucket = "ROOM";
      detail = `${row.roomNumberLabel || row.roomChargeReservationId || "room"} ${row.guestName || ""}`.trim();
    } else if (route === "IKRAM") {
      bucket = "IKRAM";
      detail = row.guestName || "compliment";
    }
    const pay = payments.get(bucket) ?? { total: 0, lines: [] };
    pay.total += route === "IKRAM" ? total : total;
    pay.lines.push({ label: detail, total: money(total), ticketId: row.id });
    payments.set(bucket, pay);

    for (const line of row.lines) {
      if (line.kitchenStatus === "VOID") continue;
      const cat = line.menuItem?.category;
      const group = (cat?.revenueCode || cat?.name || "OTHER").toUpperCase();
      const g = groups.get(group) ?? { count: 0, total: 0 };
      const lineTotal = line.qty * Number(line.unitPriceAzn);
      g.count += line.qty;
      g.total += lineTotal;
      groups.set(group, g);
      const d = dishes.get(line.description) ?? { qty: 0, total: 0 };
      d.qty += line.qty;
      d.total += lineTotal;
      dishes.set(line.description, d);
    }
  }

  const holders = await prisma.fnbLimitHolder.findMany({
    where: { organizationId: outlet.organizationId, active: true },
    select: { id: true, displayName: true },
  });
  const holderName = new Map(holders.map((h) => [h.id, h.displayName]));

  const show = (id: XReportBlock) => !hidden.has(id);
  const openTotal = open.reduce((s, t) => s + Number(t.totalAzn), 0);

  return {
    outlet: { id: outlet.id, code: outlet.code, name: outlet.name, hallMode: outlet.hallMode },
    businessDay: ymd,
    hidden: [...hidden],
    salesTotal: money(sales),
    checkCount: rows.length,
    covers: rows.reduce((s, r) => s + r.covers, 0),
    checks: show("checks") ? { count: rows.length, total: money(sales) } : null,
    groups: show("groups")
      ? [...groups.entries()].map(([name, v]) => ({ name, count: v.count, total: money(v.total) }))
      : null,
    waiters: show("waiters")
      ? [...waiters.entries()].map(([name, v]) => ({ name, count: v.count, total: money(v.total) }))
      : null,
    cashiers: show("cashiers")
      ? [...cashiers.entries()].map(([name, v]) => ({ name, count: v.count, total: money(v.total) }))
      : null,
    discount: show("discount") ? { amount: money(discount), service: 0 } : null,
    dishes: show("dishes")
      ? [...dishes.entries()].map(([name, v]) => ({ name, qty: v.qty, total: money(v.total) }))
      : null,
    payments: show("payments")
      ? [...payments.entries()].map(([key, v]) => ({
          key,
          total: money(v.total),
          lines: v.lines.map((line) => ({
            ...line,
            label: key.startsWith("LIMIT:")
              ? `${holderName.get(key.slice("LIMIT:".length)) || line.label} · ${line.ticketId.slice(0, 8)}`
              : line.label,
          })),
        }))
      : null,
    openCash: show("openCash")
      ? {
          total: money(openTotal),
          checks: open.map((t) => ({
            id: t.id,
            total: money(Number(t.totalAzn)),
            waiter: t.waiterLabel,
            openedAt: t.openedAt.toISOString(),
          })),
        }
      : null,
  };
}
