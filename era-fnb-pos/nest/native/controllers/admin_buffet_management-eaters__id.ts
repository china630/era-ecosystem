/** Lifted from nest/generated/admin_buffet_management-eaters__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { patchManagementEater } from "@/lib/buffet-management-eaters.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  included: z.boolean().optional(),
  displayLabel: z.string().min(1).max(200).optional(),
});


@Controller()
export class AdminBuffetManagementEatersIdController {
  @Patch("api/admin/buffet/management-eaters/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
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
    const eaters = await patchManagementEater(id, body);
    return sendJson(httpRes, { eaters });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "EATER_NOT_FOUND"
    ) {
      return sendJson(httpRes, { error: "Eater not found" }, 404);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
