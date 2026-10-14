import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { refundFolioPayment } from '@/lib/services/folio-refund.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';

const schema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const original = await prisma.folioPayment.findUnique({
      where: { id },
      select: { folio: { select: { reservationId: true } }, amount: true },
    });
    const payment = await refundFolioPayment({
      paymentId: id,
      amount: body.amount,
      reason: body.reason,
      createdByUserId: session?.sub,
    });
    if (original) {
      await recordHotelAudit({ userId: session?.sub, request }, 'Reservation', original.folio.reservationId, 'REFUND', {
        paymentId: id,
        amount: body.amount ?? original.amount,
        reason: body.reason,
        reservationId: original.folio.reservationId,
      });
    }
    return jsonOk(serialize(payment), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
