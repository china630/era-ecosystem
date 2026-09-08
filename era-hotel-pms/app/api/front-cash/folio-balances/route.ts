import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
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
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const tabRaw = new URL(request.url).searchParams.get('tab') ?? 'inHouse';
    const tab = (TABS.includes(tabRaw as FolioBalanceTab) ? tabRaw : 'inHouse') as FolioBalanceTab;
    return jsonOk(serialize(await listReservationFolioBalances(tab)));
  } catch (err) {
    return handleRouteError(err);
  }
}
