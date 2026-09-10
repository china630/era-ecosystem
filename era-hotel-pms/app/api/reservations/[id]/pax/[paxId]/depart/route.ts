import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { departGuestFromStay } from '@/lib/services/depart-guest.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; paxId: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id, paxId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      departedAt?: string;
      folioMode?: 'LEAVE_ON_PRIMARY' | 'CLOSE_PERSONAL';
    };
    const result = await departGuestFromStay(id, paxId, {
      departedAt: body.departedAt ? new Date(body.departedAt) : undefined,
      folioMode: body.folioMode,
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
