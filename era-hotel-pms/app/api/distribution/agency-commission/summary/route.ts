import { todayBakuYmd } from '@era/satellite-kit/time';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listCommissionSummary } from '@/lib/services/agency-commission.service';

export async function GET(request: Request) {
  try {
    assertAnyPermission(await getSatelliteSession(), [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.SCREEN_DISTRIBUTION,
    ]);
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const to = url.searchParams.get('to') ?? from;
    return jsonOk(await listCommissionSummary(from, to));
  } catch (err) {
    return handleRouteError(err);
  }
}
