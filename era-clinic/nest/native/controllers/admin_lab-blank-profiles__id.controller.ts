import { Controller, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getLabBlankProfileId, setLabBlankProfileActive } from "@/domain/catalog/diagnostic-catalog-admin.service";


const bodySchema = z.object({
  active: z.boolean(),
});

@Controller()
export class AdminLabBlankProfilesIdController {

  @Patch("api/admin/lab-blank-profiles/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const row = await getLabBlankProfileId(id);
    if (!row) throw new HttpException({ error: "Not found" }, 404);
    await setLabBlankProfileActive(id, body.active);
    return { id, active: body.active };
  
        });
  }
}
