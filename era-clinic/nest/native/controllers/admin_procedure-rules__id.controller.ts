import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateProcedureRule } from "@/lib/procedure-rules.service";


const patchSchema = z.object({
  kind: z.enum(["SEQUENCE_GAP", "MUTUAL_EXCLUSION"]).optional(),
  minGapMinutes: z.number().int().nonnegative().optional(),
});

@Controller()
export class AdminProcedureRulesIdController {

  @Patch("api/admin/procedure-rules/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return await updateProcedureRule(id, body);
  
        });
  }
}
