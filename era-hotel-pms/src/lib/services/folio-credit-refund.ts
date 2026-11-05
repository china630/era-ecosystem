import { prisma } from '@/lib/prisma';
import { pocketNetMoney } from '@/lib/folio-money-pair';
import { postPayment } from '@/lib/services/folio.service';

/** Hand back guest-folio credit. Amount matches the checkout pocket unused. */
export async function refundGuestCredit(
  reservationId: string,
  input: { method?: 'CASH' | 'CARD'; bankTerminalId?: string; reason: string },
): Promise<void> {
  const folios = await prisma.folio.findMany({
    where: { reservationId, status: 'OPEN' },
    include: { charges: true, payments: true },
  });
  for (const folio of folios) {
    const unused = pocketNetMoney(folio.charges, folio.payments).unused;
    if (unused <= 0.01) continue;
    const amount = unused;
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
