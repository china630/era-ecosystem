import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listNightAuditRunsReport } from '@/lib/services/reports.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100);
    return jsonOk(serialize(await listNightAuditRunsReport(limit)));
  } catch (err) {
    return handleRouteError(err);
  }
}
