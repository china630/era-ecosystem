import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listOutboundEventLog } from '@/lib/integration/event-dispatcher';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const status = url.searchParams.get('status') ?? undefined;
    const logs = await listOutboundEventLog({ limit, status });
    return jsonOk(serialize(logs));
  } catch (err) {
    return handleRouteError(err);
  }
}
