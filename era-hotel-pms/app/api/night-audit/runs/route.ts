import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listNightAuditRuns } from '@/lib/services/night-audit.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '5', 10);
    const runs = await listNightAuditRuns(limit);
    return jsonOk(serialize(runs));
  } catch (err) {
    return handleRouteError(err);
  }
}
