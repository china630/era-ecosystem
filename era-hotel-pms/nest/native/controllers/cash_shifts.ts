/** Lifted from era-hotel-pms/nest/generated/cash_shifts.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { closeOpenCashShift, listRecentCashShifts, openCashShiftExplicit } from '@/lib/services/cash-shift.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const openSchema = z.object({
  cashier: z.string().min(1),
  registerId: z.string().min(1),
  isPrimary: z.boolean().optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});


@Controller()
export class CashShiftsController {
  @Get("api/cash/shifts")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    return sendJson(httpRes, serialize(await listRecentCashShifts()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/cash/shifts")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const url = requestUrl;
    const action = url.searchParams.get('action');
    if (action === 'close') {
      const closed = await closeOpenCashShift({
        userId: session?.sub,
        request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
      });
      return sendJson(httpRes, serialize(closed));
    }
    const body = openSchema.parse(httpReq.body);
    const shift = await openCashShiftExplicit({
      ...body,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    return sendJson(httpRes, serialize(shift), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
