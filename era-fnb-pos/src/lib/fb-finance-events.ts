import {
  SATELLITE_FB_SALE_COMPLETED,
  SATELLITE_FB_SHIFT_CLOSED,
} from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";

/** Emit revenue journal event for local cashier pays only (never folio/hub). */
export async function dispatchFbSaleCompleted(opts: {
  ticketId: string;
  outletId: string;
  outletCode?: string;
  amountAzn: number;
  paymentMethod: string;
  receiptId: string;
  lineCount: number;
}) {
  const openShift = await prisma.posShift.findFirst({
    where: { outletId: opts.outletId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });

  await dispatchSatelliteEvent({
    type: SATELLITE_FB_SALE_COMPLETED,
    payload: {
      ticketId: opts.ticketId,
      outletId: opts.outletId,
      outletCode: opts.outletCode,
      shiftId: openShift?.id,
      receiptId: opts.receiptId,
      amountNet: opts.amountAzn,
      currency: "AZN",
      paymentMethod: opts.paymentMethod,
      lineCount: opts.lineCount,
    },
  });
}

export async function dispatchFbShiftClosed(opts: {
  shiftId: string;
  outletId: string;
  outletCode?: string;
  openedAt: Date;
  closedAt: Date;
}) {
  const closedTickets = await prisma.ticket.findMany({
    where: {
      outletId: opts.outletId,
      status: "CLOSED",
      closedAt: { gte: opts.openedAt, lte: opts.closedAt },
      roomChargeReservationId: null,
      settlementPendingId: null,
    },
    select: { totalAzn: true },
  });
  const totalSales = closedTickets.reduce(
    (s, t) => s + Number(t.totalAzn),
    0,
  );

  await dispatchSatelliteEvent({
    type: SATELLITE_FB_SHIFT_CLOSED,
    payload: {
      outletId: opts.outletId,
      outletCode: opts.outletCode,
      shiftId: opts.shiftId,
      totalSales,
      ticketCount: closedTickets.length,
      currency: "AZN",
    },
  });
}
