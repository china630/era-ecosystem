import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { deleteEmptyReservation } from '@/lib/services/delete-reservation.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CANCEL);
    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    return jsonOk(serialize(await deleteEmptyReservation(id, body.reason, { userId: session?.sub, request })));
  } catch (err) {
    return handleRouteError(err);
  }
}
