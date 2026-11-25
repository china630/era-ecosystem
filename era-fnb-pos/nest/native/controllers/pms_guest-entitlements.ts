/** Lifted from nest/generated/pms_guest-entitlements.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { fetchGuestEntitlements } from "@/lib/pms-bridge-client";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PmsGuestEntitlementsController {
  @Get("api/pms/guest-entitlements")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    await assertHotelFnbFeature("in-house");
    const denied = denyUnlessPermission(session, PERMISSIONS.PMS_ENTITLEMENTS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const reservationId = url.searchParams.get("reservationId")?.trim();
    const roomNumber = url.searchParams.get("roomNumber")?.trim();
    if (!reservationId && !roomNumber) {
      return sendJson(httpRes, 
        { error: "reservationId or roomNumber required" }, 400);
    }

    const entitlements = await fetchGuestEntitlements({ reservationId, roomNumber });
    if (!entitlements) {
      return sendJson(httpRes, { found: false });
    }
    return sendJson(httpRes, entitlements);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
