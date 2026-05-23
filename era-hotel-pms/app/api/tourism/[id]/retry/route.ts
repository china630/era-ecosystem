import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { retryTourismSubmission } from '@/lib/services/tourism.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id } = await params;
    return jsonOk(serialize(await retryTourismSubmission(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
