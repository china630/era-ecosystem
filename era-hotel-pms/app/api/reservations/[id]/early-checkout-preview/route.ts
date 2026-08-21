import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { previewEarlyCheckoutUnusedNights } from '@/lib/services/early-checkout-unused-nights.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = await params;
    const preview = await previewEarlyCheckoutUnusedNights(id);
    return jsonOk(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
