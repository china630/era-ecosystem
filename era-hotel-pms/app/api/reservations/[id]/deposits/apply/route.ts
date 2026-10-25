import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { moveHeldDepositsOntoFolio } from '@/lib/services/folio-deposit.service';

const bodySchema = z.object({
  folioId: z.string().uuid(),
  amount: z.number().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = bodySchema.parse(await request.json());
    const folio = await prisma.folio.findUnique({
      where: { id: body.folioId },
      select: { reservationId: true },
    });
    if (!folio) return jsonError('Folio not found', 404);
    const moved = await moveHeldDepositsOntoFolio(folio.reservationId);
    if (moved <= 0) return jsonError('No held deposit to apply', 400);
    return jsonOk(serialize({ applied: moved }));
  } catch (err) {
    return handleRouteError(err);
  }
}
