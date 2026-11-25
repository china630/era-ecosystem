/** Lifted from nest/generated/admin_buffet_templates.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { createWeekTemplate, listWeekTemplates } from "@/lib/buffet-week-template.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  outletId: z.string().min(1),
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
  kind: z.enum(["GUEST", "STAFF"]).optional(),
  active: z.boolean().optional(),
  seedSlots: z.boolean().optional(),
});


@Controller()
export class AdminBuffetTemplatesController {
  @Get("api/admin/buffet/templates")
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
    const outletId = url.searchParams.get("outletId") ?? undefined;
    const kindRaw = url.searchParams.get("kind");
    const kind =
      kindRaw === "GUEST" || kindRaw === "STAFF" ? kindRaw : undefined;
    const templates = await listWeekTemplates(outletId || undefined, kind);
    return sendJson(httpRes, { templates });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/buffet/templates")
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
    const template = await createWeekTemplate(body);
    return sendJson(httpRes, template, 201);
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
