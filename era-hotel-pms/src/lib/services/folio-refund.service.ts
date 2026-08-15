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

  return postPayment({
    folioId: original.folioId,
    amount,
    paymentMethod: original.paymentMethod,
    kind: 'REFUND',
    refundOfPaymentId: original.id,
    refundReason: input.reason ?? 'Payment refund',
    registerRef: `refund:${original.id}`,
  });
}
