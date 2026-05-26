import { SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED } from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";

export async function dispatchStockConsumptionIfEnabled(
  ticketId: string,
  paymentMethod: string,
  amountAzn: number,
): Promise<void> {
  if (process.env.STOCK_CONSUMPTION_ENABLED !== "true") return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      outlet: true,
      lines: { include: { menuItem: true } },
    },
  });
  if (!ticket) return;

  const lines = ticket.lines
    .filter((l) => l.kitchenStatus !== "VOID")
    .map((l) => ({
      sku: l.menuItem?.recipeSku ?? l.menuItem?.plu ?? `line-${l.id.slice(0, 6)}`,
      qty: l.qty,
      description: l.description,
    }));
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
