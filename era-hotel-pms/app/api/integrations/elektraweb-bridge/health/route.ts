import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { authenticateBridgeRequest } from '@/lib/integration/elektraweb-bridge/auth';
import {
  getBridgeOrganizationId,
  getExpectedElektrawebHotelId,
  isElektrawebBridgeEnabled,
} from '@/lib/integration/elektraweb-bridge/config';
import { getBridgeHealth } from '@/lib/integration/elektraweb-bridge/ingest';

export async function GET(request: Request) {
  try {
    // Allow unauthenticated read of enabled flag only; full health needs auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return jsonOk({
        enabled: isElektrawebBridgeEnabled(),
        organizationIdConfigured: !!process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim(),
        elektrawebHotelIdConfigured: !!process.env.ELEKTRAWEB_HOTEL_ID?.trim(),
      });
    }

    const auth = await authenticateBridgeRequest(request);
    const health = getBridgeHealth();
    return jsonOk({
      ...health,
      organizationId: auth.organizationId,
      elektrawebHotelId: auth.elektrawebHotelId,
      expectedOrganizationId: getBridgeOrganizationId(),
      expectedElektrawebHotelId: getExpectedElektrawebHotelId(),
      authVia: auth.via,
      login: auth.login,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
