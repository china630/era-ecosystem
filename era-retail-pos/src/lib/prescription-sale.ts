import { Prisma } from "@prisma/client";
import { postHotelSettlementPending, postRoomCharge } from "@/lib/pms-bridge-client";
import { revenueCodeForSaleLine } from "@/lib/revenue-code";
import { prisma } from "@/lib/prisma";

type RxLine = { sku: string; qty: number; description?: string };

type QueueRow = {
  id: string;
  reservationId: string | null;
  linesJson: string;
  receiptId: string | null;
};

async function pricedLines(lines: RxLine[]) {
  const priced = [];
  for (const line of lines) {
    const product = await prisma.productCache.findFirst({
      where: { sku: line.sku },
      select: { description: true, unitPrice: true },
    });
    if (!product) throw new Error(`Unknown SKU ${line.sku}`);
    const unitPrice = Number(product.unitPrice);
    if (!(unitPrice > 0)) throw new Error(`Price is required for ${line.sku}`);
    priced.push({
      sku: line.sku,
      qty: line.qty,
      description: line.description?.trim() || product.description,
      unitPrice,
      lineTotal: unitPrice * line.qty,
    });
  }
  return priced;
}

async function openTill() {
  const shift = await prisma.shift.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
    include: { register: { include: { outlet: true } } },
  });
  if (!shift) throw new Error("Open a POS shift before dispensing");
  return shift;
}

async function postMoney(row: QueueRow, sign: 1 | -1) {
  const lines = await pricedLines(JSON.parse(row.linesJson) as RxLine[]);
  const shift = await openTill();
  const outlet = shift.register.outlet;
  for (const line of lines) {
    const revenueCode = await revenueCodeForSaleLine({
      plu: line.sku,
      outletRevenueCode: outlet.revenueCode,
    });
    const amount = sign * line.lineTotal;
    const qty = sign * line.qty;
    const key = `${sign < 0 ? "rx-return" : "rx"}:${row.id}:${line.sku}`;
    if (row.reservationId) {
      const charge = await postRoomCharge(
        {
          reservationId: row.reservationId,
          revenueCode,
          amount,
          qty,
          productSku: line.sku,
          description: line.description,
          outletCode: outlet.code,
          externalTicketId: key,
        },
        key,
      );
      if (!charge.ok) throw new Error(`Hotel folio rejected the prescription (${charge.status})`);
    } else {
      await postHotelSettlementPending({
        sourceRef: row.id,
        amount,
        description: line.description,
        payerLabel: outlet.code,
        idempotencyKey: key,
        sku: line.sku,
        qty,
        revenueCode,
      });
    }
  }
}

/** In-house folio line, or walk-in hotel cashier. No second amount later. */
export async function settlePrescription(row: QueueRow) {
  await postMoney(row, 1);
}

/** The check: price, SKU, and the item revenue code. Money already moved. */
export async function ringPrescriptionSale(row: QueueRow) {
  const lines = await pricedLines(JSON.parse(row.linesJson) as RxLine[]);
  const shift = await openTill();
  const outlet = shift.register.outlet;
  const amount = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  for (const line of lines) {
    await revenueCodeForSaleLine({ plu: line.sku, outletRevenueCode: outlet.revenueCode });
  }
  const receipt = await prisma.receipt.create({
    data: {
      outletId: outlet.id,
      registerId: shift.registerId,
      shiftId: shift.id,
      status: "PAID",
      amountNet: new Prisma.Decimal(amount),
      subtotalAmount: new Prisma.Decimal(amount),
      paymentMethod: row.reservationId ? "FOLIO" : "CASH",
      paidAt: new Date(),
      reservationId: row.reservationId,
      settlementChannel: row.reservationId ? "HOTEL_FOLIO" : "CASHIER",
      lines: {
        create: lines.map((line) => ({
          description: line.description,
          qty: line.qty,
          unitPrice: new Prisma.Decimal(line.unitPrice),
          lineTotal: new Prisma.Decimal(line.lineTotal),
          plu: line.sku,
          rxRequired: true,
        })),
      },
    },
  });
  return receipt.id;
}

/** Goods are back. Take the folio line off, or pay the walk-in cashier refund. */
export async function refundPrescriptionSale(row: QueueRow) {
  await postMoney(row, -1);
}
