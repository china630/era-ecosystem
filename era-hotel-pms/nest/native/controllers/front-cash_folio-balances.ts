/** Lifted from era-hotel-pms/nest/generated/front-cash_folio-balances.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationFolioBalances, type FolioBalanceTab } from '@/lib/services/folio-balances.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const TABS: FolioBalanceTab[] = [
  'inHouse',
  'inHouseBalanced',
  'inHouseGuestBalanced',
  'reservation',
];


@Controller()
export class FrontCashFolioBalancesController {
  @Get("api/front-cash/folio-balances")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = requestUrl;
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
