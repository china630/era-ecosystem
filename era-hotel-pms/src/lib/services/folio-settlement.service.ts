import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { folioBalance, postPayment } from '@/lib/services/folio.service';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import type { PaymentMethod } from '@prisma/client';
import { captureAuthorization } from '@/lib/services/card-auth.service';
import { moveHeldDepositsOntoFolio } from '@/lib/services/folio-deposit.service';

const CP_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CP_TOKEN =
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();

async function burnLoyaltyPoints(customerRef: string, points: number, idempotencyKey: string) {
  const orgId = requestOrganizationId();
  if (!CP_URL || !CP_TOKEN || !orgId || orgId === 'demo-org') {
    return { burned: points, mode: 'mock' as const };
  }
  const res = await fetch(`${CP_URL}/api/platform/loyalty/v1/points/burn`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CP_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': orgId,
    },
    body: JSON.stringify({ customerRef, points, idempotencyKey, reason: 'folio_settlement' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Loyalty burn failed: ${text}`);
  }
  return res.json();
}

export type SettlementLine = {
  method: PaymentMethod;
  amount: number;
  registerRef?: string;
  bankReference?: string;
  bankTerminalId?: string;
  loyaltyCustomerRef?: string;
  authorizationId?: string;
};

async function allocatePaymentFifo(folioId: string, paymentId: string, amount: number) {
  const charges = await prisma.folioCharge.findMany({
    where: { folioId },
    orderBy: [{ businessDate: 'asc' }, { id: 'asc' }],
    include: { paymentAllocations: true },
  });
  let left = amount;
  for (const charge of charges) {
    if (left <= 0.009) break;
    const gross = decimalToNumber(charge.amount) * charge.qty;
    if (gross <= 0.009) continue;
    const already = charge.paymentAllocations.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
    const open = gross - already;
    if (open <= 0.009) continue;
    const take = Math.min(open, left);
    await prisma.folioPaymentAllocation.create({
      data: {
        paymentId,
        chargeId: charge.id,
        amount: toDecimal(Math.round(take * 100) / 100),
      },
    });
    left -= take;
  }
}

export async function settleFolio(input: {
  folioId: string;
  lines: SettlementLine[];
  discountAmount?: number;
  discountDescription?: string;
  applyDeposits?: boolean;
  createdByUserId?: string;
  auditRequest?: Request;
}) {
  const folio = await prisma.folio.findUnique({
    where: { id: input.folioId },
    include: { charges: true, payments: true, reservation: { include: { guest: true } } },
  });
  if (!folio) throw new Error('Folio not found');
  if (folio.status !== 'OPEN') throw new Error('Folio is not open');

  if (input.discountAmount && input.discountAmount > 0) {
    const { postDiscount } = await import('@/lib/services/folio.service');
    await postDiscount({
      reservationId: folio.reservationId,
      amount: input.discountAmount,
      description: input.discountDescription ?? 'Settlement discount',
      audit: { userId: input.createdByUserId, request: input.auditRequest },
    });
  }

  if (input.lines.some((l) => l.method === 'DEPOSIT')) {
    throw new Error('DEPOSIT_INTAKE_CLOSED');
  }
  if (input.applyDeposits) {
    await moveHeldDepositsOntoFolio(folio.reservationId);
  }

  const refreshed = await prisma.folio.findUnique({
    where: { id: input.folioId },
    include: { charges: true, payments: true, reservation: { include: { guest: true } } },
  });
  if (!refreshed) throw new Error('Folio not found');

  const balance = folioBalance(refreshed.charges, refreshed.payments);
  const cashLines = input.lines.filter((l) => l.method !== 'DEPOSIT');
  const lineSum = cashLines.reduce((s, l) => s + l.amount, 0);
  if (lineSum + 0.01 < balance) {
    throw new Error(
      `Settlement total ${lineSum.toFixed(2)} is less than balance ${balance.toFixed(2)}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.folioSettlement.create({
      data: {
        reservationId: refreshed.reservationId,
        folioId: refreshed.id,
        totalDue: toDecimal(balance),
        status: 'OPEN',
      },
    });

    for (const line of cashLines) {
      if (line.method === 'LOYALTY_POINTS') {
        const ref =
          line.loyaltyCustomerRef ??
          refreshed.reservation.guest.phone ??
          refreshed.reservation.guest.id;
        await burnLoyaltyPoints(ref, Math.ceil(line.amount), `settle-${settlement.id}-${line.method}`);
      }

      if (line.method === 'CARD' && line.authorizationId) {
        await captureAuthorization(line.authorizationId, line.amount);
      }

      const payment = await postPayment({
        folioId: refreshed.id,
        amount: line.amount,
        paymentMethod: line.method,
        registerRef: line.registerRef,
        bankReference: line.bankReference,
        bankTerminalId: line.bankTerminalId,
        createdByUserId: input.createdByUserId,
        auditRequest: input.auditRequest,
      });
      await allocatePaymentFifo(refreshed.id, payment.id, line.amount);

      await tx.folioPayment.update({
        where: { id: payment.id },
        data: { settlementId: settlement.id },
      });
    }

    return tx.folioSettlement.update({
      where: { id: settlement.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  });

  const { syncTourBookingsAfterFolioSettle, usedGuestTender } = await import(
    '@/lib/services/tour.service'
  );
  await syncTourBookingsAfterFolioSettle(
    input.folioId,
    usedGuestTender(cashLines.map((l) => l.method)),
  );
  return result;
}

export async function listSettlements(reservationId: string) {
  return prisma.folioSettlement.findMany({
    where: { reservationId },
    include: { payments: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFolioSettlementPreview(folioId: string) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: { charges: true, payments: true },
  });
  if (!folio) throw new Error('Folio not found');
  const held = await prisma.folioDeposit.aggregate({
    where: { reservationId: folio.reservationId, status: 'HELD' },
    _sum: { amount: true },
  });
  return {
    balance: folioBalance(folio.charges, folio.payments),
    heldDeposits: held._sum.amount != null ? decimalToNumber(held._sum.amount) : 0,
  };
}
