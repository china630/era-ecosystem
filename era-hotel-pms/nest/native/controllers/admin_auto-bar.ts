/** Lifted from era-hotel-pms/nest/generated/admin_auto-bar.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { previewAutoBar, applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  from: z.string(),
  to: z.string(),
  roomTypeId: z.string().optional(),
  baseAmount: z.coerce.number().optional(),
});


@Controller()
export class AdminAutoBarController {
  @Get("api/admin/auto-bar")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const url = requestUrl;
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      roomTypeId: url.searchParams.get("roomTypeId") ?? undefined,
      baseAmount: url.searchParams.get("baseAmount") ?? undefined,
    });
    const preview = await previewAutoBar({
      from: new Date(params.from),
      to: new Date(params.to),
      roomTypeId: params.roomTypeId,
      baseAmount: params.baseAmount,
    });
    return sendJson(httpRes, preview);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/auto-bar")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const body = querySchema.extend({ dryRun: z.boolean().optional() }).parse(
      httpReq.body,
    );
    const result = await applyAutoBar({
      from: new Date(body.from),
      to: new Date(body.to),
      roomTypeId: body.roomTypeId,
      baseAmount: body.baseAmount,
      dryRun: body.dryRun,
    });
    return sendJson(httpRes, result);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
