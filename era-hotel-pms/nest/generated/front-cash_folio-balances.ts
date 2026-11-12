import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationFolioBalances, type FolioBalanceTab } from '@/lib/services/folio-balances.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const TABS: FolioBalanceTab[] = [
  'inHouse',
  'inHouseBalanced',
  'inHouseGuestBalanced',
  'reservation',
];

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/front-cash/folio-balances", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const tabRaw = url.searchParams.get('tab') ?? 'inHouse';
    const tab = (TABS.includes(tabRaw as FolioBalanceTab) ? tabRaw : 'inHouse') as FolioBalanceTab;
    return sendJson(httpRes, 
      serialize(
        await listReservationFolioBalances(tab, {
          q: url.searchParams.get('q') ?? undefined,
          dateFrom: url.searchParams.get('dateFrom') ?? undefined,
          dateTo: url.searchParams.get('dateTo') ?? undefined,
        }),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
