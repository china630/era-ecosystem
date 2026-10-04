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
    const financeBase = process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.replace(/\/$/, '').trim();
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    if (!orgId || orgId === 'demo-org' || !financeBase || !token) {
      return jsonOk({ items: [], unavailable: true });
    }
    const url = `${financeBase}/api/internal/v1/workforce/employees/picker?organizationId=${encodeURIComponent(orgId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId,
      },
      cache: 'no-store',
    });
    if (!res.ok) return jsonOk({ items: [], unavailable: true });
    const body = (await res.json()) as {
      items?: Array<{ id: string; globalPersonId: string; name: string }>;
    };
    return jsonOk({ items: body.items ?? [], unavailable: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
