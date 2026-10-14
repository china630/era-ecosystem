import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { voidCharge } from '@/lib/services/folio.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { chargeId } = await params;
    const body = bodySchema.parse(await request.json());
    const before = await prisma.folioCharge.findUnique({
      where: { id: chargeId },
      select: { id: true, amount: true, description: true, folioId: true, folio: { select: { reservationId: true } } },
    });
    const result = await voidCharge(chargeId, body.reason);
    if (before) {
      await recordHotelAudit(
        { userId: session?.sub, request },
        'Reservation',
        result.reservationId,
        'VOID',
        { before, reason: body.reason, reservationId: result.reservationId },
      );
    }
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
