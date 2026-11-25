/** Lifted from era-hotel-pms/nest/generated/admin_travel-agencies.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listTravelAgencies, upsertTravelAgency } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  voen: z.string().optional(),
  commissionPercent: z.number().optional(),
  settlementMode: z.enum(['PREPAID', 'POSTPAID']).optional(),
  creditLimitAzn: z.number().nonnegative().nullable().optional(),
  paymentTermsDays: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
  medicalPackageCode: z.string().trim().max(40).nullable().optional(),
});


@Controller()
export class AdminTravelAgenciesController {
  @Get("api/admin/travel-agencies")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PARTIES_MANAGE);
    return sendJson(httpRes, serialize(await listTravelAgencies()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/travel-agencies")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PARTIES_MANAGE);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await upsertTravelAgency(body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
