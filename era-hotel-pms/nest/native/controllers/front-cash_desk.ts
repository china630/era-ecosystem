/** Lifted from era-hotel-pms/nest/generated/front-cash_desk.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { closeCashDeskRow, listCashDesk } from '@/lib/services/cash-desk.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const closeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payingDepartment: z.string().min(1),
  tender: z.string().min(1),
});


@Controller()
export class FrontCashDeskController {
  @Get("api/front-cash/desk")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const date =
      requestUrl.searchParams.get('date') || hotelDateKey(await getCurrentBusinessDate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendJson(httpRes, { error: 'Invalid date' }, 400);
    }
    return sendJson(httpRes, serialize(await listCashDesk(date)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/front-cash/desk")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const body = closeSchema.parse(httpReq.body);
    await closeCashDeskRow({
      businessDate: body.date,
      payingDepartment: body.payingDepartment,
      tender: body.tender,
    });
    return sendJson(httpRes, serialize(await listCashDesk(body.date)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
