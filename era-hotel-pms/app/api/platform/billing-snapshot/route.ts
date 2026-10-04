import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { getSubscriptionMe } from '@/integration/control-plane-platform.client';

export async function GET() {
  try {
    const organizationId = (await getSatelliteSession())?.organizationId;
    if (!organizationId) {
      return jsonOk({ skipped: true, reason: 'satellite organizationId not bound' });
    }
    const snapshot = await getSubscriptionMe({ organizationId });
    return jsonOk(snapshot);
  } catch (err) {
    return handleRouteError(err);
  }
}
