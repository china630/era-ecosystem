import { todayBakuYmd } from '@era/satellite-kit/time';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { queryFolioTransactions } from '@/lib/services/reports/folio-transactions.service';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const today = todayBakuYmd();
    const from = url.searchParams.get('from') ?? today;
    const to = url.searchParams.get('to') ?? from;
    return jsonOk(serialize(await queryFolioTransactions(from, to)));
  } catch (err) {
    return handleRouteError(err);
  }
}
