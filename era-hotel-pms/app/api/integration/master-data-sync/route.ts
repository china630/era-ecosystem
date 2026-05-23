import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { dispatchMasterDataSync } from '@/lib/integration/event-dispatcher';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const result = await dispatchMasterDataSync();
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
