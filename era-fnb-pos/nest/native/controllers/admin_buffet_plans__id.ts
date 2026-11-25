/** Lifted from nest/generated/admin_buffet_plans__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_STATUSES, getBuffetPlan, setBuffetPlanStatus, updateBuffetPlan, BUFFET_MEALS } from "@/lib/buffet-planner";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  serviceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meal: z.enum(BUFFET_MEALS).optional(),
  coversAdult: z.number().int().min(0).max(5000).optional(),
  coversChild: z.number().int().min(0).max(5000).optional(),
  coversSource: z.enum(["MANUAL", "HOTEL", "MIXED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(BUFFET_STATUSES).optional(),
});

type Ctx = { params: Promise<{ id: string }> };


@Controller()
export class AdminBuffetPlansIdController {
  @Get("api/admin/buffet/plans/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = httpReq.params;
    const plan = await getBuffetPlan(id);
    if (!plan) return sendJson(httpRes, { error: "Plan not found" }, 404);
    return sendJson(httpRes, plan);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/admin/buffet/plans/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = httpReq.params;
    const existing = await getBuffetPlan(id);
    if (!existing) return sendJson(httpRes, { error: "Plan not found" }, 404);
    const body = patchSchema.parse(httpReq.body);
    if (body.status) {
      const plan = await setBuffetPlanStatus(id, body.status);
      return sendJson(httpRes, plan);
    }
    const plan = await updateBuffetPlan(id, {
      serviceDateYmd: body.serviceDate,
      meal: body.meal,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      coversSource: body.coversSource,
      notes: body.notes,
    });
    if (!plan) return sendJson(httpRes, { error: "Plan not found" }, 404);
    return sendJson(httpRes, plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_CLOSED") return sendJson(httpRes, { error: "Plan is closed" }, 409);
      if (code === "PLAN_SLOT_TAKEN") {
        return sendJson(httpRes, 
          { error: "A plan already exists for that outlet, date, and meal", code: "PLAN_SLOT_TAKEN" }, 409);
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
