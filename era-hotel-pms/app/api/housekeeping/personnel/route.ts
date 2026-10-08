import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from '@era/satellite-kit';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requestOrganizationId } from '@/lib/request-organization';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const orgId = requestOrganizationId();
    const token = resolveSatelliteEventServiceToken();
    const base = resolveOrchestratorBaseUrl().replace(/\/$/, '');
    if (!orgId || orgId === 'demo-org' || !token || !base) {
      return jsonOk({ items: [], unavailable: true });
    }
    const url = `${base}/internal/v1/workforce/organizations/${encodeURIComponent(orgId)}/picker`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-service-token': token,
          'x-organization-id': orgId,
        },
        cache: 'no-store',
      });
    } catch {
      return jsonOk({ items: [], unavailable: true });
    }
    if (!res.ok) return jsonOk({ items: [], unavailable: true });
    const body = (await res.json()) as {
      items?: Array<{ id: string; globalPersonId: string; name: string }>;
    };
    return jsonOk({ items: body.items ?? [], unavailable: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
