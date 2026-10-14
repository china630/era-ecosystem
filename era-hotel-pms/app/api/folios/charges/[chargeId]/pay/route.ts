import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { payFolioCharge } from '@/lib/services/tour.service';
import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { applyHeldDepositsToFolio } from '@/lib/services/folio-deposit.service';

const bodySchema = z.object({
  paymentMethod: z.enum(DESK_PAYMENT_METHODS),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ chargeId: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    await requireHotelModule('hotel_core', session.organizationId);
    const { chargeId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    if (body.paymentMethod === 'DEPOSIT') {
      const charge = await prisma.folioCharge.findUnique({
        where: { id: chargeId },
        select: { amount: true, qty: true, folioId: true },
      });
      if (!charge) return jsonError('Charge not found', 404);
      const applied = await applyHeldDepositsToFolio(
        charge.folioId,
        decimalToNumber(charge.amount) * charge.qty,
      );
      if (applied.amount <= 0.01) return jsonError('No held deposit to apply', 400);
      return jsonOk(serialize(applied));
    }
    return jsonOk(
      serialize(await payFolioCharge(chargeId, body.paymentMethod, body.bankTerminalId, session.sub)),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}
