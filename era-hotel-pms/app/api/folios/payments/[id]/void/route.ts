import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { voidFolioPayment } from '@/lib/services/folio.service';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const existing = await prisma.folioPayment.findUnique({
      where: { id },
      select: { amount: true, paymentMethod: true, folio: { select: { reservationId: true } } },
    });
    const updated = await voidFolioPayment({ paymentId: id, reason: body.reason });
    if (existing) {
      await recordHotelAudit({ userId: session?.sub, request }, 'Reservation', existing.folio.reservationId, 'DELETE_PAYMENT', {
        paymentId: id,
        amount: existing.amount,
        paymentMethod: existing.paymentMethod,
        reason: body.reason,
        reservationId: existing.folio.reservationId,
      });
    }
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
