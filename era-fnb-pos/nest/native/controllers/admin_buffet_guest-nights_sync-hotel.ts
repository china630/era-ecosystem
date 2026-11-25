/** Lifted from nest/generated/admin_buffet_guest-nights_sync-hotel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { syncGuestNightsFromHotel } from "@/lib/buffet-guest-nights.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outletId: z.string().min(1).nullable().optional(),
});


@Controller()
export class AdminBuffetGuestNightsSyncHotelController {
  @Post("api/admin/buffet/guest-nights/sync-hotel")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = bodySchema.parse(httpReq.body);
    const result = await syncGuestNightsFromHotel({
      fromYmd: body.from,
      toYmd: body.to,
      outletId: body.outletId,
    });
    return sendJson(httpRes, result);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "DATE_ORDER") return sendJson(httpRes, { error: "from must be on or before to" }, 400);
      if (code === "HOTEL_UNAVAILABLE") {
        return sendJson(httpRes, 
          {
            error: "Hotel guest-nights pull failed — use Manual",
            code: "HOTEL_UNAVAILABLE",
          }, 503);
      }
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
