import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { getFoStatusDashboard } from '@/lib/services/fo-status-dashboard.service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.REPORTS_READ, PERMISSIONS.RESERVATIONS_READ]);
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const day = dateParam && YMD.test(dateParam) ? dateParam : todayBakuYmd();
    const includeWaiting = url.searchParams.get('waiting') === '1';
    const withRevenue = url.searchParams.get('revenue') === '1';
    return jsonOk(
      serialize(
        await getFoStatusDashboard(session.organizationId, day, { includeWaiting, withRevenue }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
