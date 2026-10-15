import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postPayment } from '@/lib/services/folio.service';

function balanceOf(charges: Array<{ amount: unknown; qty: number }>, payments: Array<{ amount: unknown; kind: string; voidedAt: Date | null }>): number {
  const chargeSum = charges.reduce((sum, row) => sum + decimalToNumber(row.amount as never) * row.qty, 0);
  const paySum = payments.reduce((sum, row) => {
    if (row.voidedAt) return sum;
    const amount = decimalToNumber(row.amount as never);
    return sum + (row.kind === 'REFUND' ? -amount : amount);
  }, 0);
  return Math.round((chargeSum - paySum) * 100) / 100;
}

/** Hand back a guest-folio credit created when a paid procedure was removed. */
export async function refundGuestCredit(
  reservationId: string,
  input: { method?: 'CASH' | 'CARD'; bankTerminalId?: string; reason: string },
): Promise<void> {
  const folios = await prisma.folio.findMany({
    where: { reservationId, type: 'GUEST', status: 'OPEN' },
    include: { charges: true, payments: true },
  });
  for (const folio of folios) {
    const balance = balanceOf(folio.charges, folio.payments);
    if (balance >= -0.01) continue;
    const amount = Math.round(-balance * 100) / 100;
    if (!input.method) {
      throw new Error('Choose how to return the procedure overpayment');
    }
    await postPayment({
      folioId: folio.id,
      amount,
      paymentMethod: input.method,
      bankTerminalId: input.method === 'CARD' ? input.bankTerminalId : undefined,
      kind: 'REFUND',
      refundReason: input.reason,
    });
  }
}
