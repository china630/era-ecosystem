import { SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED } from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";

export function isStockConsumptionEnabled(): boolean {
  return process.env.STOCK_CONSUMPTION_ENABLED === "true";
}

export type StockLineShape = {
  id: string;
  kitchenStatus: string;
  qty: number;
  description: string;
  menuItem?: { recipeSku?: string | null; plu?: string | null } | null;
};

/** VOID lines never deplete recipe/stock (AC-FNB-INV deny). */
export function buildStockConsumptionLines(
  lines: StockLineShape[],
): Array<{ sku: string; qty: number; description: string }> {
  return lines
    .filter((l) => l.kitchenStatus !== "VOID")
    .map((l) => ({
      sku: l.menuItem?.recipeSku ?? l.menuItem?.plu ?? `line-${l.id.slice(0, 6)}`,
      qty: l.qty,
      description: l.description,
    }));
}

export async function dispatchStockConsumptionIfEnabled(
  ticketId: string,
  paymentMethod: string,
  amountAzn: number,
): Promise<void> {
  if (!isStockConsumptionEnabled()) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      outlet: true,
      lines: { include: { menuItem: true } },
    },
  });
  if (!ticket) return;

  const lines = buildStockConsumptionLines(ticket.lines);
  if (lines.length === 0) return;

  await dispatchSatelliteEvent({
    type: SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED,
    payload: {
      ticketId: ticket.id,
      outletId: ticket.outletId,
      outletCode: ticket.outlet.code,
      paymentMethod,
      amountAzn,
      currency: "AZN",
      lines,
    },
  });
}
