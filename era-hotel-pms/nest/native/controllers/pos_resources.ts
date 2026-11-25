/** Lifted from era-hotel-pms/nest/generated/pos_resources.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createPosResource, listPosResources } from '@/lib/services/pos.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** @deprecated Lite calendar moved to era-fnb-pos; kept for backward compatibility. */








const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  resourceType: z.enum(['TABLE', 'SPA_CABIN']),
  outletCode: z.string().optional(),
});


@Controller()
export class PosResourcesController {
  @Get("api/pos/resources")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.POS_READ);
    return sendJson(httpRes, serialize(await listPosResources()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/pos/resources")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.POS_WRITE);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createPosResource(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
