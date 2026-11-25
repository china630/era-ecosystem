/** Lifted from era-hotel-pms/nest/generated/admin_yield-rules__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { findYieldRuleById, updateYieldRule, deleteYieldRule } from '@/lib/services/yield-pricing.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const updateSchema = z.object({
  propertyCode: z.string().min(1).optional(),
  minOccupancyPct: z.number().min(0).max(100).optional(),
  rateAdjustment: z.number().optional(),
  active: z.boolean().optional(),
});


@Controller()
export class AdminYieldRulesIdController {
  @Patch("api/admin/yield-rules/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const existing = await findYieldRuleById(id);
    if (!existing) return sendJson(httpRes, { error: 'Yield rule not found' }, 404);
    const rule = await updateYieldRule(id, body);
    return sendJson(httpRes, serialize(rule));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/admin/yield-rules/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const { id } = httpReq.params;
    const existing = await findYieldRuleById(id);
    if (!existing) return sendJson(httpRes, { error: 'Yield rule not found' }, 404);
    await deleteYieldRule(id);
    return sendJson(httpRes, { deleted: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
