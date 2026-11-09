import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { admitGuestToClinic, revokeGuestClinicAdmit } from '@/lib/services/clinic-admit.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; paxId: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id, paxId } = await params;
    const body = (await request.json().catch(() => ({}))) as { admit?: boolean };
    const result = body.admit === false
      ? await revokeGuestClinicAdmit(id, paxId)
      : await admitGuestToClinic(id, paxId);
    return jsonOk(serialize(result));
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 404 || status === 409) {
      return jsonError(err instanceof Error ? err.message : 'Conflict', status);
    }
    return handleRouteError(err);
  }
}
