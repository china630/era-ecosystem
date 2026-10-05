import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  listReservationFolioBalances,
  type FolioBalanceTab,
} from '@/lib/services/folio-balances.service';

const TABS: FolioBalanceTab[] = [
  'inHouse',
  'inHouseBalanced',
  'inHouseGuestBalanced',
  'reservation',
];

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const tabRaw = url.searchParams.get('tab') ?? 'inHouse';
    const tab = (TABS.includes(tabRaw as FolioBalanceTab) ? tabRaw : 'inHouse') as FolioBalanceTab;
    return jsonOk(
      serialize(
        await listReservationFolioBalances(tab, {
          q: url.searchParams.get('q') ?? undefined,
          dateFrom: url.searchParams.get('dateFrom') ?? undefined,
          dateTo: url.searchParams.get('dateTo') ?? undefined,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
