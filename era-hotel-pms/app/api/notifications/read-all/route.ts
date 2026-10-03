import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';

export async function PATCH() {
  try {
    if (!(await getSatelliteSession())) return jsonError('Unauthorized', 401);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
