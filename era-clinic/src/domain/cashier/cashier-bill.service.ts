import { prisma } from "@/lib/prisma";
import {
  resolveBillingTarget,
  type BillingTargetKind,
} from "@/lib/billing-router";
import type {
  ClinicReceiptChannel,
  ClinicReceiptLineSource,
  PatientOrigin,
} from "@prisma/client";

export type BillLine = {
  serviceCode: string;
  description: string;
  amount: number;
  sourceType: ClinicReceiptLineSource;
  sourceId: string | null;
  discountAmount?: number;
};

export type UnifiedBill = {
  visitId: string;
  patientRefId: string;
  patientRef: { id: string; refCode: string; fullName: string };
  patientOrigin: PatientOrigin;
  channel: ClinicReceiptChannel;
  completedAt: Date | null;
  reservationId: string | null;
  roomNumber: string | null;
  lines: BillLine[];
  amountGross: number;
  discountAmount: number;
  amountNet: number;
  alreadyPaid: boolean;
  settlementPendingId: string | null;
};

export function billingTargetToChannel(
  target: BillingTargetKind,
): ClinicReceiptChannel {
  if (target === "HOTEL_FOLIO") return "HOTEL_FOLIO";
  if (target === "SETTLEMENT_HUB") return "SETTLEMENT_HUB";
  // FINANCE with local cashier collection
  return "LOCAL";
}

export async function resolveVisitChannel(
  origin: PatientOrigin,
  stored?: string | null,
): Promise<ClinicReceiptChannel> {
  if (stored === "HOTEL_FOLIO") return "HOTEL_FOLIO";
  if (stored === "SETTLEMENT_HUB") return "SETTLEMENT_HUB";
  if (stored === "FINANCE") return "LOCAL";
  const target = await resolveBillingTarget(origin);
  return billingTargetToChannel(target);
}

/**
 * Build a unified patient bill for a completed visit:
 * visit service lines + linked lab items + linked procedures with amount.
 */
export async function buildUnifiedBill(visitId: string): Promise<UnifiedBill | null> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patientRef: { select: { id: true, refCode: true, fullName: true } },
      serviceLines: true,
      receipts: { where: { status: "PAID" }, take: 1 },
      labOrders: {
        include: {
          items: true,
        },
      },
      procedureOrders: {
        where: {
          status: { in: ["COMPLETED", "NO_SHOW", "CHECKED_IN"] },
        },
      },
    },
  });
  if (!visit) return null;

  const lines: BillLine[] = [];

  for (const sl of visit.serviceLines) {
    const amount = Number(sl.amount);
    if (amount <= 0) continue;
    lines.push({
      serviceCode: sl.serviceCode,
      description: sl.description,
      amount,
      sourceType: "VISIT_LINE",
      sourceId: sl.id,
    });
  }

  for (const lo of visit.labOrders) {
    if (lo.items.length > 0) {
      for (const item of lo.items) {
        const amount = Number(item.amountNet);
        if (amount <= 0) continue;
        lines.push({
          serviceCode: item.serviceCode,
          description: item.serviceCode,
          amount,
          sourceType: "LAB_ITEM",
          sourceId: item.id,
        });
      }
    } else {
      const amount = Number(lo.amountNet);
      if (amount > 0) {
        lines.push({
          serviceCode: lo.testCode,
          description: lo.testCode,
          amount,
          sourceType: "LAB_ITEM",
          sourceId: lo.id,
        });
      }
    }
  }

  for (const po of visit.procedureOrders) {
    const amount = Number(po.amountNet);
    if (amount <= 0) continue;
    lines.push({
      serviceCode: po.procedureCode,
      description: po.procedureName,
      amount,
      sourceType: "PROCEDURE",
      sourceId: po.id,
    });
  }

  // Fallback: visit.amountNet when no lines materialised
  if (lines.length === 0 && Number(visit.amountNet) > 0) {
    lines.push({
      serviceCode: "VISIT",
      description: `Visit ${visit.id}`,
      amount: Number(visit.amountNet),
      sourceType: "VISIT_LINE",
      sourceId: visit.id,
    });
  }

  const discountAudits = await prisma.visitDiscountAudit.findMany({
    where: { visitId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const amountGross = lines.reduce((s, l) => s + l.amount, 0);
  const discountPct = discountAudits[0] ? Number(discountAudits[0].percent) : 0;
  const discountAmount =
    discountPct > 0 ? Math.round(amountGross * (discountPct / 100) * 100) / 100 : 0;
  const amountNet = Math.max(0, Math.round((amountGross - discountAmount) * 100) / 100);

  const channel = await resolveVisitChannel(visit.patientOrigin, visit.billingTarget);

  return {
    visitId: visit.id,
    patientRefId: visit.patientRefId,
    patientRef: visit.patientRef,
    patientOrigin: visit.patientOrigin,
    channel,
    completedAt: visit.completedAt,
    reservationId: visit.reservationId,
    roomNumber: visit.roomNumber,
    lines,
    amountGross,
    discountAmount,
    amountNet,
    alreadyPaid: visit.receipts.length > 0 || !!visit.settledAt,
    settlementPendingId: visit.settlementPendingId,
  };
}

export type QueueFilters = {
  dateFrom?: string;
  dateTo?: string;
  patientRefId?: string;
  origin?: PatientOrigin;
  channel?: ClinicReceiptChannel;
  page?: number;
  pageSize?: number;
};

export async function listCashierQueue(filters: QueueFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const createdAt: { gte?: Date; lt?: Date } = {};
  if (filters.dateFrom) {
    createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
  }
  if (filters.dateTo) {
    const end = new Date(`${filters.dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    createdAt.lt = end;
  }

  const visits = await prisma.visit.findMany({
    where: {
      status: "COMPLETED",
      settledAt: null,
      ...(filters.patientRefId ? { patientRefId: filters.patientRefId } : {}),
      ...(filters.origin ? { patientOrigin: filters.origin } : {}),
      ...(Object.keys(createdAt).length
        ? { completedAt: createdAt }
        : {}),
      receipts: { none: { status: "PAID" } },
    },
    include: {
      patientRef: { select: { id: true, refCode: true, fullName: true } },
      serviceLines: true,
      receipts: { where: { status: "PAID" }, take: 1 },
    },
    orderBy: { completedAt: "desc" },
    take: 500,
  });

  const rows: Array<{
    visitId: string;
    patientRef: { id: string; refCode: string; fullName: string };
    patientOrigin: PatientOrigin;
    channel: ClinicReceiptChannel;
    completedAt: Date | null;
    amountNet: number;
    amountGross: number;
    lineCount: number;
    reservationId: string | null;
    roomNumber: string | null;
    settlementPendingId: string | null;
  }> = [];

  for (const v of visits) {
    const bill = await buildUnifiedBill(v.id);
    if (!bill || bill.alreadyPaid) continue;
    if (bill.amountNet <= 0 && bill.lines.length === 0) continue;
    if (filters.channel && bill.channel !== filters.channel) continue;
    rows.push({
      visitId: bill.visitId,
      patientRef: bill.patientRef,
      patientOrigin: bill.patientOrigin,
      channel: bill.channel,
      completedAt: bill.completedAt,
      amountNet: bill.amountNet,
      amountGross: bill.amountGross,
      lineCount: bill.lines.length,
      reservationId: bill.reservationId,
      roomNumber: bill.roomNumber,
      settlementPendingId: bill.settlementPendingId,
    });
  }

  const total = rows.length;
  const data = rows.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize };
}
