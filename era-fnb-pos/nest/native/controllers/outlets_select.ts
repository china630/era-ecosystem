/** Lifted from nest/generated/outlets_select.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { findOutletById } from "@/lib/outlet.service";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { capabilitiesFromOutletRow } from "@/lib/outlet-capabilities";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  outletId: z.string().min(1),
});


@Controller()
export class OutletsSelectController {
  @Post("api/outlets/select")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (session?.pin === true) {
      return sendJson(httpRes, 
        { error: "Forbidden: PIN session cannot rebind outlet" }, 403);
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLET_BIND);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = bodySchema.parse(httpReq.body);
    const outlet = await findOutletById(body.outletId);
    if (!outlet?.active) {
      return sendJson(httpRes, { error: "Outlet not found" }, 404);
    }
    const capabilities = capabilitiesFromOutletRow(outlet);
    cookieSeconds(httpRes, OUTLET_COOKIE, outlet.id, 60 * 60 * 24 * 30);
    return sendJson(httpRes, {
      ok: true,
      outletId: outlet.id,
      code: outlet.code,
      capabilities,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
