import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateRotationRule } from "@/lib/procedure-rotation.service";


const patchSchema = z.object({
  name: z.string().min(1).optional(),
  memberCodes: z.array(z.string().min(1)).min(1).optional(),
  scope: z.enum(["BODY_PART", "GROUP"]).optional(),
  maxConsecutiveDays: z.number().int().min(1).max(14).optional(),
  restProcedureCode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

@Controller()
export class AdminProcedureRotationRulesIdController {

  @Patch("api/admin/procedure-rotation-rules/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return await updateRotationRule(id, body);
  
        });
  }
}
