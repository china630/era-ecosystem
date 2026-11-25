import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateSubstitutionRule } from "@/lib/procedure-substitution.service";


const patchSchema = z.object({
  originalCode: z.string().min(1).optional(),
  substituteCode: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

@Controller()
export class AdminProcedureSubstitutionRulesIdController {

  @Patch("api/admin/procedure-substitution-rules/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return await updateSubstitutionRule(id, body);
  
        });
  }
}
