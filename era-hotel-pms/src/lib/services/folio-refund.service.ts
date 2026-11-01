import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postPayment } from '@/lib/services/folio.service';

/**
 * Refund a prior PAYMENT (partial or full). Creates FolioPayment kind=REFUND.
 * Mock fiscal — no live NBC credit note required for H-BL-42.
 */
export async function refundFolioPayment(input: {
  paymentId: string;
  amount?: number;
  reason?: string;
  paymentMethod?: 'CASH' | 'CARD';
  bankTerminalId?: string;
  createdByUserId?: string;
  auditRequest?: Request;
}) {
  const original = await prisma.folioPayment.findUnique({
    where: { id: input.paymentId },
    include: { folio: true },
  });
  if (!original) throw new Error('Payment not found');
  if (original.kind === 'REFUND') throw new Error('Cannot refund a refund');
  if (original.folio.status === 'TRANSFERRED_AR') {
    throw new Error('Cannot refund on TRANSFERRED_AR folio — reverse in Finance first');
  }
  if (!['OPEN', 'CLOSED', 'PENDING_AR'].includes(original.folio.status)) {
    throw new Error('Folio status does not allow refund');
  }

  const already = await prisma.folioPayment.aggregate({
    where: { refundOfPaymentId: original.id, kind: 'REFUND' },
    _sum: { amount: true },
  });
  const refundedSoFar = already._sum.amount != null ? decimalToNumber(already._sum.amount) : 0;
  const originalAmt = decimalToNumber(original.amount);
  const remaining = originalAmt - refundedSoFar;
  if (remaining <= 0.01) throw new Error('Payment already fully refunded');

  const amount = input.amount != null ? input.amount : remaining;
  if (amount <= 0.01) throw new Error('Refund amount must be positive');
  if (amount > remaining + 0.01) {
    throw new Error(`Refund ${amount.toFixed(2)} exceeds remaining ${remaining.toFixed(2)}`);
  }

  const method = input.paymentMethod ?? original.paymentMethod;
  if (method !== original.paymentMethod && !(input.reason && input.reason.trim())) {
    throw new Error('REFUND_REASON_REQUIRED');
  }
  const { isPaymentCategory, resolvePaymentCategory } = await import('@/lib/payment-category');
  const category =
    (original.paymentCategory && isPaymentCategory(original.paymentCategory)
      ? original.paymentCategory
      : null) ?? resolvePaymentCategory(original);

  return postPayment({
    folioId: original.folioId,
    amount,
    paymentMethod: method,
    bankTerminalId: input.bankTerminalId ?? original.bankTerminalId ?? undefined,
    kind: 'REFUND',
    refundOfPaymentId: original.id,
    paymentCategory: category ?? undefined,
    revenueCodeId: original.revenueCodeId ?? undefined,
    createdByUserId: input.createdByUserId,
    auditRequest: input.auditRequest,
    refundReason: (() => {
      const reason = input.reason?.trim() ?? '';
      if (!reason) throw new Error('REFUND_REASON_REQUIRED');
      return reason;
    })(),
    registerRef: `refund:${original.id}`,
  });
}
