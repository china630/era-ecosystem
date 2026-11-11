import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeLineTotal } from "@/lib/receipt-line-validation";
import { totalsFromReceipt } from "@/lib/receipt-totals";

type ReceiptWithLines = Prisma.ReceiptGetPayload<{ include: { lines: true } }>;

type PaidReceiptForReturn = Prisma.ReceiptGetPayload<{
  include: { lines: true; shift: true; outlet: true };
}>;

type ReceiptLineInput = {
  description: string;
  qty: number;
  unitPrice: number;
  plu?: string;
  barcode?: string;
  isWeighted?: boolean;
  weightKg?: number;
  size?: string;
  color?: string;
  serial?: string;
  batch?: string;
  rxRequired?: boolean;
  rxApprovedBy?: string;
};

export async function getShiftWithOutletForReceipt(shiftId: string) {
  return prisma.shift.findUnique({
    where: { id: shiftId },
    include: { register: { include: { outlet: true } } },
  });
}

export async function createReceiptFromLines(input: {
  outletId: string;
  registerId: string;
  shiftId: string;
  subtotalAmount: number;
  lines: ReceiptLineInput[];
}) {
  return prisma.receipt.create({
    data: {
      outletId: input.outletId,
      registerId: input.registerId,
      shiftId: input.shiftId,
      subtotalAmount: input.subtotalAmount,
      amountNet: input.subtotalAmount,
      lines: {
        create: input.lines.map((line) => ({
          description: line.description,
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: computeLineTotal(line),
          plu: line.plu ?? null,
          barcode: line.barcode ?? null,
          isWeighted: line.isWeighted ?? false,
          weightKg: line.weightKg ?? null,
          size: line.size ?? null,
          color: line.color ?? null,
          serial: line.serial ?? null,
          batch: line.batch ?? null,
          rxRequired: line.rxRequired ?? false,
          rxApprovedBy: line.rxApprovedBy ?? null,
          lineStatus: "ACTIVE",
        })),
      },
    },
    include: { lines: true },
  });
}

export async function getPaidReceiptForReturn(id: string): Promise<PaidReceiptForReturn | null> {
  return (await prisma.receipt.findUnique({
    where: { id },
    include: { lines: true, shift: true, outlet: true },
  })) as PaidReceiptForReturn | null;
}

export async function createReturnReceipt(input: {
  outletId: string;
  registerId: string;
  shiftId: string;
  amountNet: number;
  paymentMethod: string | null;
  originalReceiptId: string;
  lines: PaidReceiptForReturn["lines"];
}) {
  return prisma.receipt.create({
    data: {
      outletId: input.outletId,
      registerId: input.registerId,
      shiftId: input.shiftId,
      status: "PAID",
      amountNet: input.amountNet,
      paymentMethod: input.paymentMethod ?? "return",
      paidAt: new Date(),
      originalReceiptId: input.originalReceiptId,
      lines: {
        create: input.lines
          .filter((line) => line.lineStatus === "ACTIVE")
          .map((line) => ({
            description: `RETURN: ${line.description}`,
            qty: -line.qty,
            unitPrice: line.unitPrice,
            lineTotal: -Number(line.lineTotal),
            plu: line.plu,
            barcode: line.barcode,
            isWeighted: line.isWeighted,
            weightKg: line.weightKg,
            size: line.size,
            color: line.color,
            serial: line.serial,
            batch: line.batch,
            rxRequired: line.rxRequired,
            rxApprovedBy: line.rxApprovedBy,
            lineStatus: "ACTIVE",
          })),
      },
    },
    include: { lines: true },
  });
}

export async function getReceiptForPay(id: string) {
  return prisma.receipt.findUnique({
    where: { id },
    include: {
      lines: true,
      outlet: true,
      register: true,
      shift: true,
    },
  });
}

export async function markReceiptPendingHub(
  id: string,
  data: {
    paymentMethod: string;
    customerPhone: string | null;
    loyaltyRef: string | null;
    hubPendingIds: string;
  },
) {
  return prisma.receipt.update({
    where: { id },
    data: {
      status: "PENDING_HUB",
      paymentMethod: data.paymentMethod,
      customerPhone: data.customerPhone,
      loyaltyRef: data.loyaltyRef,
      settlementChannel: "HOTEL_HUB",
      hubPendingIds: data.hubPendingIds,
    },
    include: { lines: true },
  });
}

export async function markReceiptPaid(
  id: string,
  data: {
    paymentMethod: string;
    customerPhone: string | null;
    loyaltyRef: string | null;
    fiscalNumber: string | null;
    reservationId: string | null;
    roomNumber: string | null;
    settlementChannel: string | null;
  },
) {
  return prisma.receipt.update({
    where: { id },
    data: {
      status: "PAID",
      paymentMethod: data.paymentMethod,
      customerPhone: data.customerPhone,
      loyaltyRef: data.loyaltyRef,
      fiscalNumber: data.fiscalNumber,
      paidAt: new Date(),
      reservationId: data.reservationId,
      roomNumber: data.roomNumber,
      settlementChannel: data.settlementChannel,
    },
    include: { lines: true },
  });
}

export async function getReceiptById(id: string) {
  return prisma.receipt.findUnique({ where: { id } });
}

export async function voidReceiptById(id: string) {
  return prisma.receipt.update({
    where: { id },
    data: { status: "VOID" },
  });
}

export async function getReceiptWithLines(id: string): Promise<ReceiptWithLines | null> {
  return (await prisma.receipt.findUnique({
    where: { id },
    include: { lines: true },
  })) as ReceiptWithLines | null;
}

export async function voidReceiptLineAndRecalcTotals(input: {
  receiptId: string;
  lineId: string;
  receipt: ReceiptWithLines;
  linesAfterVoid: ReceiptWithLines["lines"];
}) {
  await prisma.receiptLine.update({
    where: { id: input.lineId },
    data: { lineStatus: "VOID" },
  });
  const { subtotal, discountAmount, amountNet } = totalsFromReceipt(
    input.receipt,
    input.linesAfterVoid,
  );
  return prisma.receipt.update({
    where: { id: input.receiptId },
    data: { subtotalAmount: subtotal, discountAmount, amountNet },
    include: { lines: true },
  });
}

export async function getReceiptWithOutlet(id: string) {
  return prisma.receipt.findUnique({
    where: { id },
    include: { outlet: true },
  });
}

export async function markReceiptBopis(
  id: string,
  data: {
    pickupSlotKey: string;
    customerPhone: string | null | undefined;
  },
) {
  return prisma.receipt.update({
    where: { id },
    data: {
      fulfillmentType: "BOPIS",
      pickupSlotKey: data.pickupSlotKey,
      bopisScheduledAt: new Date(),
      customerPhone: data.customerPhone,
    },
  });
}

export async function applyPromoToReceipt(
  id: string,
  data: {
    subtotal: number;
    promoCode: string | null;
    discountPercent: number | null;
    discountAmount: number;
    amountNet: number;
  },
) {
  return prisma.receipt.update({
    where: { id },
    data: {
      subtotalAmount: data.subtotal,
      promoCode: data.promoCode,
      discountPercent: data.discountPercent,
      discountAmount: data.discountAmount,
      amountNet: data.amountNet,
    },
    include: { lines: true },
  });
}

export async function getReceiptForHubSettlement(sourceRef: string) {
  return prisma.receipt.findUnique({
    where: { id: sourceRef },
    include: { lines: true, outlet: true },
  });
}

export async function updateReceiptHubPendingIds(receiptId: string, hubPendingIds: string) {
  return prisma.receipt.update({
    where: { id: receiptId },
    data: { hubPendingIds },
  });
}

export async function settleReceiptFromHub(
  receiptId: string,
  data: {
    paymentMethod: string | null | undefined;
    fiscalNumber: string | null | undefined;
    existingPaymentMethod: string | null;
    existingFiscalNumber: string | null;
  },
) {
  return prisma.receipt.update({
    where: { id: receiptId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: data.paymentMethod?.trim() || data.existingPaymentMethod,
      fiscalNumber: data.fiscalNumber ?? data.existingFiscalNumber,
      settlementChannel: "HOTEL_HUB",
      hubPendingIds: null,
    },
  });
}
