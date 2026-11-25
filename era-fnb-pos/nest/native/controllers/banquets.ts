/** Lifted from nest/generated/banquets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listActiveBanquets } from "@/lib/pms-bridge-client";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { HOTEL_READ_BANQUETS } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class BanquetsController {
  @Get("api/banquets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_BANQUETS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await assertHotelFnbFeature("banquets");
    const events = await listActiveBanquets();
    return sendJson(httpRes, events);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
