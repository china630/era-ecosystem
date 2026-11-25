/** Lifted from nest/generated/admin_buffet_management-eaters.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { createManualEater, listManagementEaters, syncManagementEatersFromHr } from "@/lib/buffet-management-eaters.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sync"),
    outletId: z.string().min(1).nullable().optional(),
  }),
  z.object({
    action: z.literal("manual"),
    displayLabel: z.string().min(1).max(200),
    outletId: z.string().min(1).nullable().optional(),
  }),
]);


@Controller()
export class AdminBuffetManagementEatersController {
  @Get("api/admin/buffet/management-eaters")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const outletId = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).searchParams.get("outletId");
    const eaters = await listManagementEaters(outletId || undefined);
    return sendJson(httpRes, { eaters });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/buffet/management-eaters")
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
    const body = postSchema.parse(httpReq.body);
    if (body.action === "sync") {
      const result = await syncManagementEatersFromHr(body.outletId);
      return sendJson(httpRes, result);
    }
    const eaters = await createManualEater({
      displayLabel: body.displayLabel,
      outletId: body.outletId,
    });
    return sendJson(httpRes, { eaters }, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "ORCH_UNAVAILABLE") {
        return sendJson(httpRes, 
          { error: "Workforce leadership sync unavailable", code: "ORCH_UNAVAILABLE" }, 503);
      }
      if (code === "LABEL_REQUIRED") return sendJson(httpRes, { error: "Label required" }, 400);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
