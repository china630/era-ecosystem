import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { moveGuestBetweenStays } from '@/lib/services/move-guest.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; paxId: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id, paxId } = await params;
    const body = (await request.json()) as {
      toReservationId?: string;
      effectiveDate?: string;
    };
    if (!body.toReservationId) {
      return jsonError('toReservationId is required', 400);
    }
    const result = await moveGuestBetweenStays(id, paxId, body.toReservationId, {
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
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
