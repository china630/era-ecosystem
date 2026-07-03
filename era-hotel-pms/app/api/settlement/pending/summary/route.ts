import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPendingSummary } from '@/lib/services/settlement-hub.service';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const summary = await getPendingSummary();
    return jsonOk(serialize(summary));
  } catch (err) {
    return handleRouteError(err);
  }
}
