import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { transferFolioPayment } from '@/lib/services/folio-transfer.service';

const bodySchema = z.object({
  note: z.string().trim().min(1).max(500),
  targetFolioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  targetReservationId: z.string().uuid().optional(),
  targetReservationGuestId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    return jsonOk(
      serialize(
        await transferFolioPayment({
          paymentId: id,
          note: body.note,
          targetFolioType: body.targetFolioType,
          targetReservationId: body.targetReservationId,
          targetReservationGuestId: body.targetReservationGuestId,
          actorUserId: session?.sub,
          request,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
