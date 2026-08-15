import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listFrontCashJournal } from '@/lib/services/front-cash-transactions.service';

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const from = dayStart(url.searchParams.get('from') ?? today);
    const to = dayStart(url.searchParams.get('to') ?? today);
    const cashShiftId = url.searchParams.get('cashShiftId') ?? undefined;
    return jsonOk(serialize(await listFrontCashJournal({ from, to, cashShiftId })));
  } catch (err) {
    return handleRouteError(err);
  }
}
