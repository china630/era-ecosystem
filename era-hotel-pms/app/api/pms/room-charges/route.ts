import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { findRoomChargeByIdempotencyKey } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const key =
      url.searchParams.get('externalTicketId') ??
      url.searchParams.get('idempotencyKey');
    if (!key) {
      throw new Error('externalTicketId or idempotencyKey query required');
    }
    const charge = await findRoomChargeByIdempotencyKey(key);
    if (!charge) {
      throw new Error('Room charge not found for idempotency key');
    }
    return jsonOk(serialize(charge));
  } catch (err) {
    return handleRouteError(err);
  }
}
