/** Lifted from nest/generated/sales.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saleReportForScope } from "@/lib/sales-report";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class SalesController {
  @Get("api/sales")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const scope = url.searchParams.get("scope") === "shift" ? "shift" : "today";
    const channelRaw = url.searchParams.get("channel");
    const methodRaw = url.searchParams.get("method");
    const channel = channelRaw === "TAKEAWAY" || channelRaw === "DINE_IN" ? channelRaw : undefined;
    const method =
      methodRaw === "CASH" || methodRaw === "CARD" || methodRaw === "TRANSFER" ? methodRaw : undefined;
    const date = url.searchParams.get("date") ?? undefined;
    const shiftId = url.searchParams.get("shiftId") ?? undefined;
    return sendJson(httpRes, await saleReportForScope(scope, { date, channel, method, shiftId }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
