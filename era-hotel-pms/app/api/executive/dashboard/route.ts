import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getExecutiveDashboard } from '@/lib/services/executive-dashboard.service';

export async function GET(request: Request) {
  try {
    assertAnyPermission(await getSessionFromHeaders(), [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : new Date();
    return jsonOk(serialize(await getExecutiveDashboard(date)));
  } catch (err) {
    return handleRouteError(err);
  }
}
