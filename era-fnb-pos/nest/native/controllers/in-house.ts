/** Lifted from nest/generated/in-house.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listInHouseGuests } from "@/lib/pms-bridge-client";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { HOTEL_READ_IN_HOUSE } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class InHouseController {
  @Get("api/in-house")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_IN_HOUSE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await assertHotelFnbFeature("in-house");
    const query = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).searchParams.get("query") ?? undefined;
    const guests = await listInHouseGuests(query);
    return sendJson(httpRes, guests);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
