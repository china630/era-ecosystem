import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateCompatibilityRule } from "@/lib/procedure-compatibility.service";


const patchSchema = z.object({
  ruleType: z.enum(["FORBID_SAME_DAY", "MIN_HOURS_GAP", "FORBID_SEQUENCE"]).optional(),
  minHours: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
});

@Controller()
export class AdminProcedureCompatibilityRulesIdController {

  @Patch("api/admin/procedure-compatibility-rules/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return await updateCompatibilityRule(id, body);
  
        });
  }
}
