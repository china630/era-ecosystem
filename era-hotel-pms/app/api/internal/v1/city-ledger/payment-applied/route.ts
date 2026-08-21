import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { postPayment, folioBalance } from '@/lib/services/folio.service';

const bodySchema = z.object({
  folioId: z.string().min(1),
  invoiceId: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.literal('AZN'),
  fullyPaid: z.boolean(),
});

/**
 * Finance -> Hotel callback: apply allocated AR payment into hotel folio.
 * Idempotent by `paymentId` (stored into FolioPayment.registerRef).
 */
export async function POST(request: Request) {
  try {
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());

    const existing = await prisma.folioPayment.findFirst({
      where: {
        folioId: body.folioId,
        registerRef: body.paymentId,
        kind: 'PAYMENT',
      },
      select: { id: true },
    });
    if (existing) {
      const refreshed = await prisma.folio.findUnique({
        where: { id: body.folioId },
        include: { charges: true, payments: true },
      });
      if (!refreshed) throw new Error('Folio disappeared during idempotency check');

      const bal = folioBalance(refreshed.charges, refreshed.payments);
      const nextStatus =
        Math.abs(bal) <= 0.01 || body.fullyPaid ? 'CLOSED' : 'TRANSFERRED_AR';

      await prisma.folio.update({
        where: { id: refreshed.id },
        data: { status: nextStatus },
      });

      return jsonOk({
        id: existing.id,
        paymentId: body.paymentId,
        folioId: refreshed.id,
        balance: bal,
        status: nextStatus,
        alreadyApplied: true,
      });
    }

    const folio = await prisma.folio.findUnique({
      where: { id: body.folioId },
      include: { charges: true, payments: true },
    });
    if (!folio) {
      return Response.json({ error: 'Folio not found' }, { status: 404 });
    }

    // postPayment requires OPEN status; City Ledger money path expects TRANSFERRED_AR.
    if (folio.status !== 'OPEN') {
      await prisma.folio.update({
        where: { id: folio.id },
        data: { status: 'OPEN' },
      });
    }

    const payment = await postPayment({
      folioId: folio.id,
      amount: body.amount,
      paymentMethod: 'COMPANY_ACCOUNT',
      registerRef: body.paymentId,
      bankReference: body.invoiceId,
    });

    const refreshed = await prisma.folio.findUnique({
      where: { id: folio.id },
      include: { charges: true, payments: true },
    });
    if (!refreshed) throw new Error('Folio disappeared during payment apply');

    const bal = folioBalance(refreshed.charges, refreshed.payments);
    const nextStatus =
      Math.abs(bal) <= 0.01 || body.fullyPaid ? 'CLOSED' : 'TRANSFERRED_AR';

    await prisma.folio.update({
      where: { id: folio.id },
      data: { status: nextStatus },
    });

    return jsonOk({
      id: payment.id,
      paymentId: body.paymentId,
      folioId: folio.id,
      balance: bal,
      status: nextStatus,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

