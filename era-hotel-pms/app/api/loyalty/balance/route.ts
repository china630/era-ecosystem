import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const CP_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CP_TOKEN =
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
const ORG_ID = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const customerRef = new URL(request.url).searchParams.get('customerRef');
    if (!customerRef) throw new Error('customerRef required');

    if (!CP_URL || !CP_TOKEN || !ORG_ID) {
      return jsonOk({ balance: 0, maxRedeemableAzn: 0, mode: 'mock', pointsPerAzn: 100 });
    }

    const res = await fetch(
      `${CP_URL}/api/platform/loyalty/v1/points/balance?customerRef=${encodeURIComponent(customerRef)}`,
      {
        headers: {
          Authorization: `Bearer ${CP_TOKEN}`,
          'X-Organization-Id': ORG_ID,
        },
      },
    );
    if (!res.ok) throw new Error('Balance lookup failed');
    const data = (await res.json()) as { balance?: number };
    const points = data.balance ?? 0;
    const pointsPerAzn = Number(process.env.LOYALTY_POINTS_PER_AZN ?? '100');
    return jsonOk({
      balance: points,
      maxRedeemableAzn: Math.floor(points / pointsPerAzn),
      pointsPerAzn,
      mode: 'live',
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
