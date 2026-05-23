import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { processRetryQueue } from '@/lib/integration/event-dispatcher';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const result = await processRetryQueue(20);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
