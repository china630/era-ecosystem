import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { checkoutReservation } from '@/lib/services/checkout.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = await params;
    const result = await checkoutReservation(id);
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
