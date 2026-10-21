import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { listCashJournal } from '@/lib/services/cash-desk.service';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const date =
      url.searchParams.get('date') ||
      url.searchParams.get('from') ||
      hotelDateKey(await getCurrentBusinessDate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonOk({ error: 'Invalid date' }, 400);
    }
    const lines = await listCashJournal({
      businessDate: date,
      cashPoint: url.searchParams.get('cashPoint'),
      tender: url.searchParams.get('tender'),
    });
    return jsonOk(serialize({ date, lines }));
  } catch (err) {
    return handleRouteError(err);
  }
}
