/** Lifted from nest/generated/admin_buffet_templates__id_spawn.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { spawnWeekFromTemplate } from "@/lib/buffet-week-template.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skipExisting: z.boolean().optional(),
  coversSource: z.enum(["MANUAL", "HOTEL"]).optional(),
  coversAdult: z.number().int().min(0).max(50000).optional(),
  coversChild: z.number().int().min(0).max(50000).optional(),
  productionFactorPct: z.number().min(0).max(100).optional(),
});


@Controller()
export class AdminBuffetTemplatesIdSpawnController {
  @Post("api/admin/buffet/templates/:id/spawn")
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
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const result = await spawnWeekFromTemplate(id, body.weekStart, {
      skipExisting: body.skipExisting,
      coversSource: body.coversSource,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      productionFactorPct: body.productionFactorPct,
    });
    return sendJson(httpRes, result, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "TEMPLATE_NOT_FOUND") return sendJson(httpRes, { error: "Template not found" }, 404);
      if (code === "TEMPLATE_EMPTY") {
        return sendJson(httpRes, { error: "Template has no slots — add Mon–Sun meals first" }, 400);
      }
      if (code === "PLAN_SLOT_TAKEN") {
        return sendJson(httpRes, 
          {
            error: "A plan already exists for a template slot",
            code: "PLAN_SLOT_TAKEN",
            serviceDate: (err as { serviceDate?: string }).serviceDate,
            meal: (err as { meal?: string }).meal,
          }, 409);
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
