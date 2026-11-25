/** Lifted from nest/generated/admin_buffet_plans__id_lines.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { upsertBuffetLine } from "@/lib/buffet-planner";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  menuItemId: z.string().min(1),
  station: z.string().min(1).max(64).default("MAIN"),
  plannedPortions: z.number().int().min(1).max(20000),
  wastePct: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

type Ctx = { params: Promise<{ id: string }> };


@Controller()
export class AdminBuffetPlansIdLinesController {
  @Post("api/admin/buffet/plans/:id/lines")
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
    const { id: planId } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const plan = await upsertBuffetLine({ planId, ...body });
    return sendJson(httpRes, plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_NOT_FOUND") return sendJson(httpRes, { error: "Plan not found" }, 404);
      if (code === "PLAN_NOT_DRAFT") return sendJson(httpRes, { error: "Only draft plans can be edited" }, 409);
      if (code === "MENU_ITEM_NOT_FOUND") return sendJson(httpRes, { error: "Menu item not found on this outlet" }, 404);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
