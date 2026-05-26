import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSubscriptionMe } from '@/integration/control-plane-platform.client';

export async function GET() {
  try {
    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? '';
    if (!organizationId) {
      return jsonOk({ skipped: true, reason: 'ERA_SATELLITE_ORGANIZATION_ID not set' });
    }
    const snapshot = await getSubscriptionMe({ organizationId });
    return jsonOk(snapshot);
  } catch (err) {
    return handleRouteError(err);
  }
}
