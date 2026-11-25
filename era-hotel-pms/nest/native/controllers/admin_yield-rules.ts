/** Lifted from era-hotel-pms/nest/generated/admin_yield-rules.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listYieldRules, createYieldRule } from '@/lib/services/yield-pricing.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  propertyCode: z.string().min(1).default('DEFAULT'),
  minOccupancyPct: z.number().min(0).max(100),
  rateAdjustment: z.number(),
  active: z.boolean().optional(),
});


@Controller()
export class AdminYieldRulesController {
  @Get("api/admin/yield-rules")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const rules = await listYieldRules();
    return sendJson(httpRes, serialize(rules));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/yield-rules")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const body = createSchema.parse(httpReq.body);
    const rule = await createYieldRule({
      propertyCode: body.propertyCode,
      minOccupancyPct: body.minOccupancyPct,
      rateAdjustment: body.rateAdjustment,
      active: body.active ?? true,
    });
    return sendJson(httpRes, serialize(rule), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
