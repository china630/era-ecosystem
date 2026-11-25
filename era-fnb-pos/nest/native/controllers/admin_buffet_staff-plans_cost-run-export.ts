/** Lifted from nest/generated/admin_buffet_staff-plans_cost-run-export.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { exportStaffCostRunSlice } from "@/lib/buffet-staff-meal.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Preview / export staff overlap netting for Finance cost run (Wave 5).
 * Money inputs are supplied by the caller until Finance prices BOM usage.
 */
const querySchema = z.object({
  outletId: z.string().min(1),
  foodUsageAzn: z.coerce.number().min(0),
  posAttributedAzn: z.coerce.number().min(0),
  staffGrossAzn: z.coerce.number().min(0),
});


@Controller()
export class AdminBuffetStaffPlansCostRunExportController {
  @Get("api/admin/buffet/staff-plans/cost-run-export")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const parsed = querySchema.parse({
      outletId: url.searchParams.get("outletId"),
      foodUsageAzn: url.searchParams.get("foodUsageAzn") ?? "0",
      posAttributedAzn: url.searchParams.get("posAttributedAzn") ?? "0",
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? "0",
    });
    const slice = await exportStaffCostRunSlice(parsed);
    return sendJson(httpRes, slice);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "OUTLET_NOT_FOUND"
    ) {
      return sendJson(httpRes, { error: "Outlet not found" }, 404);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
