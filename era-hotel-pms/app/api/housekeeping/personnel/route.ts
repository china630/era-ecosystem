import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from '@era/satellite-kit';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requestOrganizationId } from '@/lib/request-organization';

type PickerItem = {
  id: string;
  globalPersonId: string;
  name: string;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  positionId?: string | null;
  positionName?: string | null;
};

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
    const body = (await res.json()) as { items?: PickerItem[] };
    const items = (body.items ?? []).map((item) => ({
      id: item.id,
      globalPersonId: item.globalPersonId,
      name: item.name,
      orgUnitId: item.orgUnitId ?? null,
      orgUnitName: item.orgUnitName ?? null,
      positionId: item.positionId ?? null,
      positionName: item.positionName ?? null,
    }));
    return jsonOk({ items, unavailable: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
