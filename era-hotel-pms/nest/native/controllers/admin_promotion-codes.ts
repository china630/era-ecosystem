/** Lifted from era-hotel-pms/nest/generated/admin_promotion-codes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createPromotionCode, listPromotionCodes } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  code: z.string().min(1),
  discountPercent: z.number().min(0).max(100),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  active: z.boolean().optional(),
});


@Controller()
export class AdminPromotionCodesController {
  @Get("api/admin/promotion-codes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PROMO_ADMIN);
    return sendJson(httpRes, serialize(await listPromotionCodes()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/promotion-codes")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PROMO_ADMIN);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createPromotionCode(body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
