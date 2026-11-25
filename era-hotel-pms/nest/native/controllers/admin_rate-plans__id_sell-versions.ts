/** Lifted from era-hotel-pms/nest/generated/admin_rate-plans__id_sell-versions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { addRatePlanSellVersion, listRatePlanSellVersions } from '@/lib/services/rate-plan-sell-versions.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const postSchema = z.object({
  sellPrice: z.number().positive(),
  costFloor: z.number().min(0).nullable().optional(),
  occupancy: z.number().int().min(1).max(10).optional(),
  roomTypeId: z.string().uuid(),
  mealPlanId: z.string().uuid(),
  effectiveFrom: z.string().min(8),
  seasonId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});


@Controller()
export class AdminRatePlansIdSellVersionsController {
  @Get("api/admin/rate-plans/:id/sell-versions")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listRatePlanSellVersions(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/rate-plans/:id/sell-versions")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    const body = postSchema.parse(httpReq.body);
    const row = await addRatePlanSellVersion({
      ratePlanId: id,
      sellPrice: body.sellPrice,
      costFloor: body.costFloor,
      occupancy: body.occupancy,
      roomTypeId: body.roomTypeId,
      mealPlanId: body.mealPlanId,
      effectiveFrom: new Date(body.effectiveFrom),
      seasonId: body.seasonId,
      note: body.note,
      createdById: session?.sub,
    });
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
