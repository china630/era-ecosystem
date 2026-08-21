import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { resolveSatelliteOrganizationId } from '@era/satellite-kit';
import { getSubscriptionMe } from '@/integration/control-plane-platform.client';

export async function GET() {
  try {
    const { organizationId, source } = resolveSatelliteOrganizationId({ allowFallback: true });
    if (source === 'fallback') {
      return jsonOk({ skipped: true, reason: 'satellite organizationId not bound' });
    }
    const snapshot = await getSubscriptionMe({ organizationId });
    return jsonOk(snapshot);
  } catch (err) {
    return handleRouteError(err);
  }
}
