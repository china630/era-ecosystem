/** Lifted from nest/generated/reports_x.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { buildXReport } from "@/lib/nafta-x-report";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  outletId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});


@Controller()
export class ReportsXController {
  @Get("api/reports/x")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const q = querySchema.parse({
      outletId: url.searchParams.get("outletId") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    const outletId = q.outletId ?? (await getSelectedOutletId());
    if (!outletId) return sendJson(httpRes, { error: "Select an outlet" }, 400);
    const report = await buildXReport(outletId, q.date ?? todayBakuYmd());
    if (!report) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    return sendJson(httpRes, report);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
