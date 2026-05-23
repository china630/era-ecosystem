import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getNightAuditStatus } from '@/lib/services/night-audit.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertAnyPermission(session, [
      PERMISSIONS.NIGHT_AUDIT_RUN,
      PERMISSIONS.REPORTS_READ,
    ]);
    return jsonOk(serialize(await getNightAuditStatus()));
  } catch (err) {
    return handleRouteError(err);
  }
}
