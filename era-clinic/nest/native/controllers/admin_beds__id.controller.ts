import { Controller, Delete, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateBed, deleteBed } from "@/domain/inpatient/ward.service";
import { z } from "zod";


const patchSchema = z.object({
  code: z.string().min(1).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
});

@Controller()
export class AdminBedsIdController {

  @Patch("api/admin/beds/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const bed = await updateBed(id, body);
    return { data: bed };
  
        });
  }

  @Delete("api/admin/beds/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteBed(id);
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("active")) throw new HttpException({ error: msg }, 409);
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
