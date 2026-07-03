import { getPersonOpsProfile } from '@era/satellite-kit';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const globalPersonId = new URL(request.url).searchParams.get('globalPersonId')?.trim();
    if (!globalPersonId) {
      return jsonError('globalPersonId query parameter is required', 400);
    }
    const profile = await getPersonOpsProfile(globalPersonId);
    if (!profile) {
      return jsonError('MDM profile not found', 404);
    }
    return jsonOk(profile);
  } catch (err) {
    return handleRouteError(err);
  }
}
