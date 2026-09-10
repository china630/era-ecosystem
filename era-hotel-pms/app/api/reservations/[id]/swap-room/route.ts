import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { swapReservationRooms } from '@/lib/services/swap-rooms.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = (await request.json()) as { otherReservationId?: string };
    if (!body.otherReservationId) {
      return jsonError('otherReservationId is required', 400);
    }
    const result = await swapReservationRooms(id, body.otherReservationId, {
      actorUserId: session?.sub,
    });
    return jsonOk(serialize(result));
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 409) {
      return jsonError(err instanceof Error ? err.message : 'Conflict', 409);
    }
    return handleRouteError(err);
  }
}
