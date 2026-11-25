/** Lifted from era-hotel-pms/nest/generated/master_revenue-gl-mappings.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { REVENUE_CODE_ROLES } from '@/lib/revenue-code-match';
import { listRevenueGlMappings, setRevenueCodeRole, upsertRevenueGlMapping } from '@/lib/services/revenue-gl-mapping.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const upsertSchema = z
  .object({
    revenueCodeId: z.string().uuid(),
    glAccountCode: z.string().min(1).max(20).optional(),
    systemRole: z.enum(REVENUE_CODE_ROLES).nullable().optional(),
  })
  .refine((b) => b.glAccountCode !== undefined || b.systemRole !== undefined, {
    message: 'glAccountCode or systemRole is required',
  });


@Controller()
export class MasterRevenueGlMappingsController {
  @Get("api/master/revenue-gl-mappings")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.REVENUE_ADMIN);
    return sendJson(httpRes, serialize(await listRevenueGlMappings()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/master/revenue-gl-mappings")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.REVENUE_ADMIN);
    const body = upsertSchema.parse(httpReq.body);
    if (body.systemRole !== undefined) {
      await setRevenueCodeRole(body.revenueCodeId, body.systemRole);
    }
    const updated =
      body.glAccountCode !== undefined
        ? await upsertRevenueGlMapping(body.revenueCodeId, body.glAccountCode)
        : null;
    return sendJson(httpRes, serialize(updated ?? { revenueCodeId: body.revenueCodeId }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
