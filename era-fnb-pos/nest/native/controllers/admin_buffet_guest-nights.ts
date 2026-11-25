/** Lifted from nest/generated/admin_buffet_guest-nights.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { deleteGuestNight, listGuestNights, upsertGuestNight } from "@/lib/buffet-guest-nights.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const putSchema = z
  .object({
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    guestNights: z.number().int().min(0),
    source: z.enum(["MANUAL", "HOTEL", "ESTIMATE"]).optional(),
    outletId: z.string().min(1).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .strict();


@Controller()
export class AdminBuffetGuestNightsController {
  @Get("api/admin/buffet/guest-nights")
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
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) return sendJson(httpRes, { error: "from and to are required" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return sendJson(httpRes, { error: "from/to must be YYYY-MM-DD" }, 400);
    }
    if (from > to) return sendJson(httpRes, { error: "from must be on or before to" }, 400);
    const entries = await listGuestNights({ fromYmd: from, toYmd: to });
    const total = entries.reduce((s, e) => s + e.guestNights, 0);
    return sendJson(httpRes, { from, to, total, entries });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Put("api/admin/buffet/guest-nights")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = putSchema.parse(httpReq.body);
    const entry = await upsertGuestNight({
      serviceDateYmd: body.serviceDate,
      guestNights: body.guestNights,
      source: body.source,
      outletId: body.outletId,
      notes: body.notes,
    });
    return sendJson(httpRes, { entry });
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

  @Delete("api/admin/buffet/guest-nights")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const serviceDate = url.searchParams.get("serviceDate");
    if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return sendJson(httpRes, { error: "serviceDate YYYY-MM-DD required" }, 400);
    }
    await deleteGuestNight({ serviceDateYmd: serviceDate });
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
