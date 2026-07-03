import type {
  SettlementPendingStatus,
  SettlementSourceSystem,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';

export type CreatePendingInput = {
  sourceSystem: SettlementSourceSystem;
  sourceOrgId: string;
  sourceRef: string;
  idempotencyKey: string;
  amount: number;
  currency?: string;
  description: string;
  payerLabel?: string;
  globalPersonId?: string;
  reservationId?: string;
  businessDate?: Date;
};

export type PayPendingInput = {
  pendingId: string;
  paymentMethod: 'CASH' | 'CARD';
  amount?: number;
};

function hubCallbackBaseUrl(sourceSystem: SettlementSourceSystem): string | null {
  if (sourceSystem === 'FNB_POS') {
    return (
      process.env.FNB_POS_URL?.trim() ||
      process.env.NEXT_PUBLIC_FNB_POS_URL?.trim() ||
      process.env.NEXT_PUBLIC_SATELLITE_FNB_POS_URL?.trim() ||
      null
    );
  }
  if (sourceSystem === 'CLINIC') {
    return (
      process.env.CLINIC_URL?.trim() ||
      process.env.NEXT_PUBLIC_CLINIC_WEB_URL?.trim() ||
      process.env.NEXT_PUBLIC_SATELLITE_CLINIC_URL?.trim() ||
      null
    );
  }
  return null;
}

function bridgeSecret(): string | null {
  return (
    process.env.POS_BRIDGE_SECRET?.trim() ||
    process.env.CLINIC_BRIDGE_SECRET?.trim() ||
    null
  );
}

export async function findPendingByIdempotencyKey(idempotencyKey: string) {
  return prisma.settlementPendingCharge.findUnique({ where: { idempotencyKey } });
}

export async function createPendingCharge(input: CreatePendingInput) {
  const existing = await findPendingByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { charge: existing, idempotent: true as const };
  }

  const businessDate = input.businessDate ?? (await getCurrentBusinessDate());
  const charge = await prisma.settlementPendingCharge.create({
    data: {
      sourceSystem: input.sourceSystem,
      sourceOrgId: input.sourceOrgId,
      sourceRef: input.sourceRef,
      idempotencyKey: input.idempotencyKey,
      amount: toDecimal(input.amount),
      currency: input.currency ?? 'AZN',
      description: input.description,
      payerLabel: input.payerLabel,
      globalPersonId: input.globalPersonId,
      reservationId: input.reservationId,
      businessDate,
    },
  });
  return { charge, idempotent: false as const };
}

export async function listPendingCharges(status: SettlementPendingStatus = 'PENDING') {
  return prisma.settlementPendingCharge.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
}

export async function getPendingSummary(businessDate?: Date) {
  const date = businessDate ?? (await getCurrentBusinessDate());
  const pendingCount = await prisma.settlementPendingCharge.count({
    where: { status: 'PENDING', businessDate: date },
  });
  return { pendingCount, businessDate: date };
}

async function requireOpenCashShift() {
  let shift = await prisma.cashShift.findFirst({
    where: { status: 'OPEN', isPrimary: true },
  });
  if (!shift) {
    shift = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
  }
  if (!shift) {
    throw new Error('Open a cash shift before settling pending charges');
  }
  return shift;
}

async function notifySourceSettlementConfirmed(
  charge: {
    id: string;
    sourceSystem: SettlementSourceSystem;
    sourceRef: string;
  },
  paymentMethod: string,
  fiscalReceiptId: string | null,
) {
  const base = hubCallbackBaseUrl(charge.sourceSystem);
  const secret = bridgeSecret();
  if (!base || !secret) {
    console.warn('Settlement callback skipped: missing URL or bridge secret', {
      sourceSystem: charge.sourceSystem,
    });
    return { dispatched: false as const, reason: 'not_configured' };
  }

  const res = await fetch(`${base.replace(/\/$/, '')}/api/integration/settlement-confirmed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pos-bridge-secret': secret,
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      pendingId: charge.id,
      sourceRef: charge.sourceRef,
      paymentMethod,
      fiscalReceiptId,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Settlement callback failed: ${res.status} ${text}`);
  }
  return { dispatched: true as const };
}

export async function payPendingCharge(input: PayPendingInput) {
  const pending = await prisma.settlementPendingCharge.findUnique({
    where: { id: input.pendingId },
  });
  if (!pending) throw new Error('Pending charge not found');
  if (pending.status !== 'PENDING') {
    throw new Error(`Pending charge is ${pending.status}`);
  }

  const expected = decimalToNumber(pending.amount);
  if (input.amount != null && Math.abs(input.amount - expected) > 0.01) {
    throw new Error('Payment amount must match pending charge');
  }

  const shift = await requireOpenCashShift();

  let fiscalReceiptId: string | null = null;
  let fiscalQrPayload: string | null = null;
  if (['CASH', 'CARD'].includes(input.paymentMethod)) {
    const { fiscalize } = await import('@era/fiscal');
    try {
      const receipt = await fiscalize({
        documentRef: pending.id,
        amount: expected,
        paymentMethod: input.paymentMethod,
        registerRef: shift.registerId,
      });
      fiscalReceiptId = receipt.receiptId;
      fiscalQrPayload = receipt.qrPayload;
    } catch (e) {
      console.error('KKM fiscalize failed for pending settlement', e);
    }
  }

  const paid = await prisma.settlementPendingCharge.update({
    where: { id: pending.id },
    data: {
      status: 'PAID',
      cashShiftId: shift.id,
      paymentMethod: input.paymentMethod,
      fiscalReceiptId,
      fiscalQrPayload,
      paidAt: new Date(),
    },
  });

  await notifySourceSettlementConfirmed(paid, input.paymentMethod, fiscalReceiptId);
  return paid;
}

export async function voidPendingCharge(pendingId: string, reason: string) {
  const pending = await prisma.settlementPendingCharge.findUnique({
    where: { id: pendingId },
  });
  if (!pending) throw new Error('Pending charge not found');
  if (pending.status !== 'PENDING') {
    throw new Error(`Cannot void charge in status ${pending.status}`);
  }
  if (!reason.trim()) throw new Error('Void reason required');

  return prisma.settlementPendingCharge.update({
    where: { id: pendingId },
    data: {
      status: 'VOID',
      voidReason: reason.trim(),
      voidedAt: new Date(),
    },
  });
}

export async function assertNoOpenPendingForNightAudit(
  policy: 'BLOCK' | 'WARN',
  businessDate?: Date,
) {
  const { pendingCount, businessDate: date } = await getPendingSummary(businessDate);
  if (pendingCount === 0) {
    return { pendingCount: 0, blocked: false, note: null as string | null };
  }
  const note = `${pendingCount} pending settlement charge(s) for ${date.toISOString().slice(0, 10)}`;
  if (policy === 'BLOCK') {
    throw new Error(`Close pending settlements before night audit: ${note}`);
  }
  return { pendingCount, blocked: false, note };
}
