import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateClinicLookup } from "@/lib/services/clinic-master-data.service";


const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

@Controller()
export class AdminLookupsIdController {

  @Patch("api/admin/lookups/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updateClinicLookup(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    });
    return row;
  
        });
  }
}
