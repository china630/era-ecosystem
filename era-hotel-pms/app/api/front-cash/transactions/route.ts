import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listFrontCashJournal } from '@/lib/services/front-cash-transactions.service';

function dayStart(iso: string) {
  return bakuCivilUtcDate(iso);
}

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const today = hotelDateKey(await getCurrentBusinessDate());
    const from = dayStart(url.searchParams.get('from') ?? today);
    const to = dayStart(url.searchParams.get('to') ?? today);
    const cashShiftId = url.searchParams.get('cashShiftId') ?? undefined;
    return jsonOk(serialize(await listFrontCashJournal({ from, to, cashShiftId })));
  } catch (err) {
    return handleRouteError(err);
  }
}
