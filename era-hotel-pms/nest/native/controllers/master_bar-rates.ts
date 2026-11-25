/** Lifted from era-hotel-pms/nest/generated/master_bar-rates.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listBarRates, bulkUpsertBarRates } from '@/lib/services/bar-rates.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bulkSchema = z.object({
  ratePlanId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  amount: z.number().positive(),
  currencyCode: z.string().optional(),
});


@Controller()
export class MasterBarRatesController {
  @Get("api/master/bar-rates")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.RATES_ADMIN);
    const params = requestUrl.searchParams;
    const from = params.get('from');
    const to = params.get('to');
    return sendJson(httpRes, 
      serialize(
        await listBarRates({
          ratePlanId: params.get('ratePlanId') ?? undefined,
          roomTypeId: params.get('roomTypeId') ?? undefined,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/master/bar-rates")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const body = bulkSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await bulkUpsertBarRates(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
