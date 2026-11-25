/** Lifted from nest/generated/admin_buffet_plans.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS, BUFFET_STATUSES, listBuffetPlans, upsertBuffetPlan } from "@/lib/buffet-planner";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  outletId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(BUFFET_MEALS),
  coversAdult: z.number().int().min(0).max(5000),
  coversChild: z.number().int().min(0).max(5000).default(0),
  coversSource: z.enum(["MANUAL", "HOTEL", "MIXED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});


@Controller()
export class AdminBuffetPlansController {
  @Get("api/admin/buffet/plans")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const statusRaw = url.searchParams.get("status");
    const status =
      statusRaw && (BUFFET_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof BUFFET_STATUSES)[number])
        : undefined;
    const plans = await listBuffetPlans({
      outletId: url.searchParams.get("outletId") ?? undefined,
      fromYmd: url.searchParams.get("from") ?? undefined,
      toYmd: url.searchParams.get("to") ?? undefined,
      status,
    });
    return sendJson(httpRes, { plans });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/buffet/plans")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = createSchema.parse(httpReq.body);
    const plan = await upsertBuffetPlan({
      outletId: body.outletId,
      serviceDateYmd: body.serviceDate,
      meal: body.meal,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      coversSource: body.coversSource,
      notes: body.notes,
    });
    return sendJson(httpRes, plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "OUTLET_NOT_FOUND") {
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
