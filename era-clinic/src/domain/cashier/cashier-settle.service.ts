import { fiscalize } from "@era/fiscal";
import { prisma } from "@/lib/prisma";
import { postHotelRoomCharge } from "@/lib/billing-router";
import { postHotelSettlementPending } from "@/lib/settlement-hub-client";
import {
  buildUnifiedBill,
  type BillLine,
} from "@/domain/cashier/cashier-bill.service";
import { getCurrentShift, openShift } from "@/domain/cashier/cashier-shift.service";
import type { ClinicReceiptChannel } from "@prisma/client";

export type PaymentSplit = { method: string; amount: number };

export type SettleInput = {
  visitId: string;
  shiftId?: string;
  payments?: PaymentSplit[];
  /** Optional extra discount on top of visit discount audit */
  extraDiscount?: number;
  userId?: string | null;
  /** Force local settle for standalone over-quota */
  forceLocal?: boolean;
};

function sumPayments(payments: PaymentSplit[]): number {
  return Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
}

async function ensureShift(shiftId?: string, userId?: string | null) {
  if (shiftId) {
    const s = await prisma.clinicShift.findUnique({ where: { id: shiftId } });
    if (!s) throw new Error("Shift not found");
    if (s.status !== "OPEN") throw new Error("Shift is closed");
    return s;
  }
  const current = await getCurrentShift();
  if (current) return current;
  return openShift(userId);
}

/**
 * Settle a visit bill according to resolved channel:
 * LOCAL → receipt + mock fiscal
 * HOTEL_FOLIO → room charge
 * SETTLEMENT_HUB → pending at hotel front-cash
 * FINANCE mapped to LOCAL for cashier collection
 */
export async function settleVisitBill(input: SettleInput) {
  const bill = await buildUnifiedBill(input.visitId);
  if (!bill) throw new Error("Visit not found");
  if (bill.alreadyPaid) {
    const existing = await prisma.clinicReceipt.findFirst({
      where: { visitId: input.visitId, status: "PAID" },
      include: { lines: true, payments: true },
    });
    return { receipt: existing, channel: bill.channel, reused: true as const };
  }

  let channel: ClinicReceiptChannel = bill.channel;
  if (input.forceLocal) channel = "LOCAL";

  const discountAmount =
    Math.round((bill.discountAmount + (input.extraDiscount ?? 0)) * 100) / 100;
  const amountGross = bill.amountGross;
  const amountNet = Math.max(0, Math.round((amountGross - discountAmount) * 100) / 100);

  const shift = await ensureShift(input.shiftId, input.userId);

  if (channel === "HOTEL_FOLIO") {
    if (!bill.reservationId) throw new Error("No reservation for folio charge");
    const charge = await postHotelRoomCharge({
      reservationId: bill.reservationId,
      roomNumber: bill.roomNumber ?? undefined,
      amount: amountNet,
      description: `Clinic visit ${bill.visitId}`,
      externalTicketId: `clinic-visit-${bill.visitId}`,
    });
    const receipt = await prisma.clinicReceipt.create({
      data: {
        shiftId: shift.id,
        visitId: bill.visitId,
        patientRefId: bill.patientRefId,
        status: "PAID",
        channel: "HOTEL_FOLIO",
        amountGross,
        discountAmount,
        amountNet,
        paymentMethod: "FOLIO",
        paidAt: new Date(),
        folioChargeRef: String((charge as { id?: string })?.id ?? `folio-${bill.visitId}`),
        lines: {
          create: bill.lines.map((l) => lineCreate(l)),
        },
        payments: {
          create: [{ method: "FOLIO", amount: amountNet }],
        },
      },
      include: { lines: true, payments: true },
    });
    await prisma.visit.update({
      where: { id: bill.visitId },
      data: { settledAt: new Date(), billingTarget: "HOTEL_FOLIO" },
    });
    return { receipt, channel, fiscal: null, settlementOnly: true };
  }

  if (channel === "SETTLEMENT_HUB") {
    const pending = await postHotelSettlementPending({
      sourceRef: bill.visitId,
      amount: amountNet,
      description: `Clinic visit ${bill.visitId}`,
      payerLabel: bill.patientRef.refCode,
      globalPersonId: undefined,
      idempotencyKey: `clinic-visit-${bill.visitId}`,
    });
    const pendingId = String((pending as { id?: string }).id ?? "");
    const receipt = await prisma.clinicReceipt.create({
      data: {
        shiftId: shift.id,
        visitId: bill.visitId,
        patientRefId: bill.patientRefId,
        status: "PAID",
        channel: "SETTLEMENT_HUB",
        amountGross,
        discountAmount,
        amountNet,
        paymentMethod: "HUB",
        paidAt: new Date(),
        settlementPendingId: pendingId || null,
        lines: {
          create: bill.lines.map((l) => lineCreate(l)),
        },
        payments: {
          create: [{ method: "HUB", amount: amountNet }],
        },
      },
      include: { lines: true, payments: true },
    });
    await prisma.visit.update({
      where: { id: bill.visitId },
      data: {
        settledAt: new Date(),
        billingTarget: "SETTLEMENT_HUB",
        settlementPendingId: pendingId || null,
      },
    });
    return { receipt, channel, fiscal: null, settlementOnly: true, pendingId };
  }

  // LOCAL / FINANCE cashier collection
  const payments =
    input.payments && input.payments.length > 0
      ? input.payments
      : [{ method: "CASH", amount: amountNet }];
  const paySum = sumPayments(payments);
  if (Math.abs(paySum - amountNet) > 0.01) {
    throw new Error(`Payment split ${paySum} must equal amountNet ${amountNet}`);
  }

  const receipt = await prisma.clinicReceipt.create({
    data: {
      shiftId: shift.id,
      visitId: bill.visitId,
      patientRefId: bill.patientRefId,
      status: "OPEN",
      channel: "LOCAL",
      amountGross,
      discountAmount,
      amountNet,
      paymentMethod: payments[0]?.method ?? "CASH",
      lines: {
        create: bill.lines.map((l) => lineCreate(l)),
      },
    },
    include: { lines: true },
  });

  const fiscal = await fiscalize({
    documentRef: receipt.id,
    amount: amountNet,
    paymentMethod: payments[0]?.method ?? "CASH",
  });

  const paid = await prisma.clinicReceipt.update({
    where: { id: receipt.id },
    data: {
      status: "PAID",
      fiscalReceiptId: fiscal.receiptId,
      fiscalQrPayload: fiscal.qrPayload,
      paidAt: new Date(),
      payments: {
        create: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          fiscalReceiptId: fiscal.receiptId,
        })),
      },
    },
    include: { lines: true, payments: true },
  });

  await prisma.visit.update({
    where: { id: bill.visitId },
    data: { settledAt: new Date(), billingTarget: "FINANCE" },
  });

  return { receipt: paid, channel: "LOCAL" as const, fiscal, settlementOnly: true };
}

function lineCreate(l: BillLine) {
  return {
    serviceCode: l.serviceCode,
    description: l.description,
    amount: l.amount,
    discountAmount: l.discountAmount ?? 0,
    sourceType: l.sourceType,
    sourceId: l.sourceId,
  };
}

export async function voidReceipt(input: {
  receiptId: string;
  reason: string;
  userId?: string | null;
}) {
  const receipt = await prisma.clinicReceipt.findUnique({
    where: { id: input.receiptId },
  });
  if (!receipt) throw new Error("Receipt not found");
  if (receipt.status === "VOID") return receipt;
  if (receipt.status !== "PAID") throw new Error("Only PAID receipts can be voided");
  if (receipt.channel === "HOTEL_FOLIO" || receipt.channel === "SETTLEMENT_HUB") {
    throw new Error("Void hub/folio receipts at hotel front desk");
  }

  const updated = await prisma.clinicReceipt.update({
    where: { id: receipt.id },
    data: {
      status: "VOID",
      voidedAt: new Date(),
      voidReason: input.reason,
      voidedByUserId: input.userId ?? null,
    },
    include: { lines: true, payments: true },
  });

  if (receipt.visitId) {
    await prisma.visit.update({
      where: { id: receipt.visitId },
      data: { settledAt: null },
    });
  }
  return updated;
}

export async function reprintReceipt(receiptId: string) {
  const receipt = await prisma.clinicReceipt.findUnique({
    where: { id: receiptId },
    include: { lines: true, payments: true, patientRef: true, visit: true },
  });
  if (!receipt) throw new Error("Receipt not found");
  const updated = await prisma.clinicReceipt.update({
    where: { id: receiptId },
    data: { reprintCount: { increment: 1 } },
    include: { lines: true, payments: true, patientRef: true },
  });
  return updated;
}

export async function listReceipts(filters: {
  dateFrom?: string;
  dateTo?: string;
  status?: "OPEN" | "PAID" | "VOID";
  shiftId?: string;
  patientRefId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (filters.dateFrom) createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) {
    const end = new Date(`${filters.dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    createdAt.lt = end;
  }

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
    ...(filters.patientRefId ? { patientRefId: filters.patientRefId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.clinicReceipt.count({ where }),
    prisma.clinicReceipt.findMany({
      where,
      include: {
        patientRef: { select: { id: true, refCode: true, fullName: true } },
        lines: true,
        payments: true,
        shift: { select: { id: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { data, total, page, pageSize };
}

/** Settle a standalone over-quota charge log locally */
export async function settleChargeLogLocally(input: {
  chargeLogId: string;
  shiftId?: string;
  payments?: PaymentSplit[];
  userId?: string | null;
}) {
  const log = await prisma.procedureChargeLog.findUnique({
    where: { id: input.chargeLogId },
    include: { patientRef: true },
  });
  if (!log) throw new Error("Charge log not found");
  if (log.settledLocally) throw new Error("Already settled");
  if (Number(log.amountNet) <= 0) throw new Error("Nothing to charge");

  const shift = await ensureShift(input.shiftId, input.userId);
  const amountNet = Number(log.amountNet);
  const payments =
    input.payments && input.payments.length > 0
      ? input.payments
      : [{ method: "CASH", amount: amountNet }];

  const receipt = await prisma.clinicReceipt.create({
    data: {
      shiftId: shift.id,
      patientRefId: log.patientRefId,
      status: "OPEN",
      channel: "LOCAL",
      amountGross: amountNet,
      discountAmount: 0,
      amountNet,
      paymentMethod: payments[0]?.method ?? "CASH",
      lines: {
        create: [
          {
            serviceCode: log.procedureCode,
            description: `${log.procedureName} (over-quota)`,
            amount: amountNet,
            sourceType: "PROCEDURE",
            sourceId: log.procedureOrderId,
          },
        ],
      },
    },
  });

  const fiscal = await fiscalize({
    documentRef: receipt.id,
    amount: amountNet,
    paymentMethod: payments[0]?.method ?? "CASH",
  });

  const paid = await prisma.clinicReceipt.update({
    where: { id: receipt.id },
    data: {
      status: "PAID",
      fiscalReceiptId: fiscal.receiptId,
      fiscalQrPayload: fiscal.qrPayload,
      paidAt: new Date(),
      payments: {
        create: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          fiscalReceiptId: fiscal.receiptId,
        })),
      },
    },
    include: { lines: true, payments: true },
  });

  await prisma.procedureChargeLog.update({
    where: { id: log.id },
    data: { settledLocally: true, receiptId: paid.id, channel: "LOCAL" },
  });

  return { receipt: paid, fiscal };
}
