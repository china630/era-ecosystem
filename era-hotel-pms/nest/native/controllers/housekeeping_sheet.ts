/** Lifted from era-hotel-pms/nest/generated/housekeeping_sheet.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { generateFloorSheet, generateAllFloorSheets, generateFloorSheetPdf } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HousekeepingSheetController {
  @Get("api/housekeeping/sheet")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const sp = requestUrl.searchParams;
    const date = sp.get('date') ?? todayBakuYmd();
    if (sp.get('format') === 'pdf') {
      const rawLang = sp.get('lang');
      const lang = rawLang === 'en' || rawLang === 'ru' ? rawLang : 'az';
      const floorRaw = sp.get('floor');
      const floorNum = floorRaw == null || floorRaw === '' ? undefined : Number(floorRaw);
      const buf = await generateFloorSheetPdf(date, lang, Number.isFinite(floorNum) ? floorNum : undefined);
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="floor-sheet-${date}.pdf"`,
        },
      });
    }
    if (sp.get('all') === '1') {
      return sendJson(httpRes, serialize(await generateAllFloorSheets(date)));
    }
    const floor = Number(sp.get('floor') ?? '2');
    return sendJson(httpRes, serialize(await generateFloorSheet(date, floor)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
