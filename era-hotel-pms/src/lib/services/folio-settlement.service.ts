import { prisma } from '@/lib/prisma';
import { folioBalance, postPayment } from '@/lib/services/folio.service';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import type { PaymentMethod } from '@prisma/client';
import { captureAuthorization } from '@/lib/services/card-auth.service';

const CP_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CP_TOKEN =
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
const ORG_ID = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();

async function burnLoyaltyPoints(customerRef: string, points: number, idempotencyKey: string) {
  if (!CP_URL || !CP_TOKEN || !ORG_ID) {
    return { burned: points, mode: 'mock' as const };
  }
  const res = await fetch(`${CP_URL}/api/platform/loyalty/v1/points/burn`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CP_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': ORG_ID,
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
  loyaltyCustomerRef?: string;
  authorizationId?: string;
};

export async function settleFolio(input: {
  folioId: string;
  lines: SettlementLine[];
}) {
  const folio = await prisma.folio.findUnique({
    where: { id: input.folioId },
    include: { charges: true, payments: true, reservation: { include: { guest: true } } },
  });
  if (!folio) throw new Error('Folio not found');
  if (folio.status !== 'OPEN') throw new Error('Folio is not open');

  const balance = folioBalance(folio.charges, folio.payments);
  const lineSum = input.lines.reduce((s, l) => s + l.amount, 0);
  if (lineSum + 0.01 < balance) {
    throw new Error(`Settlement total ${lineSum.toFixed(2)} is less than balance ${balance.toFixed(2)}`);
  }

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.folioSettlement.create({
      data: {
        reservationId: folio.reservationId,
        folioId: folio.id,
        totalDue: toDecimal(balance),
        status: 'OPEN',
      },
    });

    for (const line of input.lines) {
      if (line.method === 'LOYALTY_POINTS') {
        const ref = line.loyaltyCustomerRef ?? folio.reservation.guest.phone ?? folio.reservation.guest.id;
        await burnLoyaltyPoints(ref, Math.ceil(line.amount), `settle-${settlement.id}-${line.method}`);
      }

      if (line.method === 'CARD' && line.authorizationId) {
        await captureAuthorization(line.authorizationId, line.amount);
      }

      const payment = await postPayment({
        folioId: folio.id,
        amount: line.amount,
        paymentMethod: line.method,
        registerRef: line.registerRef,
      });

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
  return { balance: folioBalance(folio.charges, folio.payments) };
}
