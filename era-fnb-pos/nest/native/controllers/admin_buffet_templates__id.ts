/** Lifted from nest/generated/admin_buffet_templates__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { describeRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { getWeekTemplate, patchWeekTemplate } from "@/lib/buffet-week-template.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ id: string }> };

function mapCode(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "TEMPLATE_NOT_FOUND") return { status: 404, body: { error: "Template not found" } };
  }
  return null;
}



const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).nullable().optional(),
  kind: z.enum(["GUEST", "STAFF"]).optional(),
  active: z.boolean().optional(),
});


@Controller()
export class AdminBuffetTemplatesIdController {
  @Get("api/admin/buffet/templates/:id")
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
    const { id } = httpReq.params;
    return sendJson(httpRes, await getWeekTemplate(id));
  } catch (err) {
    const described = mapCode(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/admin/buffet/templates/:id")
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
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, await patchWeekTemplate(id, body));
  } catch (err) {
    const described = mapCode(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
