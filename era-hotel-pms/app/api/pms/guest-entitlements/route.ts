import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getGuestEntitlements } from '@/lib/services/guest-entitlements.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.RESERVATIONS_READ);
    const params = new URL(request.url).searchParams;
    const entitlements = await getGuestEntitlements({
      roomNumber: params.get('roomNumber') ?? undefined,
      reservationId: params.get('reservationId') ?? undefined,
    });
    if (!entitlements) {
      return jsonOk({ found: false });
    }
    return jsonOk(serialize({ found: true, ...entitlements }));
  } catch (err) {
    return handleRouteError(err);
  }
}
