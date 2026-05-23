import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { runNightAudit } from '@/lib/services/night-audit.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const result = await runNightAudit();
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
