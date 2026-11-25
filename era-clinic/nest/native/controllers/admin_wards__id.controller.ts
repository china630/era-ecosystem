import { Controller, Delete, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateWard, deleteWard } from "@/domain/inpatient/ward.service";
import { z } from "zod";


const patchSchema = z.object({
  name: z.string().min(1).optional(),
  dailyChargeCode: z.string().nullable().optional(),
});

@Controller()
export class AdminWardsIdController {

  @Patch("api/admin/wards/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const ward = await updateWard(id, body);
    return { data: ward };
  
        });
  }

  @Delete("api/admin/wards/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteWard(id);
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("occupied")) throw new HttpException({ error: msg }, 409);
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
