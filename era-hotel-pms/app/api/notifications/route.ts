import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';

/** In-app notifications stub — integrate with orchestrator CP when available. */
export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError('Unauthorized', 401);
    return jsonOk({ items: [], total: 0, page: 1, pageSize: 15 });
  } catch (err) {
    return handleRouteError(err);
  }
}
