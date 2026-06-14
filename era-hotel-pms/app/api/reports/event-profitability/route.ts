import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getEventProfitabilityReport } from '@/lib/services/event-order.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';

export async function GET(req: Request) {
  try {
    await requireHotelModule('hotel_banquets');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = new URL(req.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    return jsonOk(
      serialize(
        await getEventProfitabilityReport(
          fromStr ? new Date(fromStr) : undefined,
          toStr ? new Date(toStr) : undefined,
        ),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
