/** Lifted from nest/generated/kds_lines.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listKdsActiveTicketLines } from "@/lib/kds.service";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class KdsLinesController {
  @Get("api/kds/lines")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.KDS_BUMP);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_kitchen_kds", session?.organizationId);
    const lines = await listKdsActiveTicketLines();
    return sendJson(httpRes, lines);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
