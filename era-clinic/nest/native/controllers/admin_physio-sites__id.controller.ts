import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Delete, Get, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { getPhysioSite, retirePhysioSite, updatePhysioSite } from "@/domain/physio/physio-catalog.service";


const patchSchema = z.object({
  kind: z.enum(["USSR-817", "SHCHERBAK", "HYDRO", "LOCAL"]).optional(),
  prikaz817: z.number().int().nullable().optional(),
  laterality: z.boolean().optional(),
  titleAz: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  titleLa: z.string().min(1).optional(),
  boundary: z.string().nullable().optional(),
  coarse: z.array(z.string()).min(1).optional(),
  anatomyJson: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});





/** Retire (active=false). Hard delete is forbidden. */

@Controller()
export class AdminPhysioSitesIdController {

  @Get("api/admin/physio-sites/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    return await getPhysioSite(id);
  
        });
  }

  @Patch("api/admin/physio-sites/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updatePhysioSite(id, body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "PhysioSite",
      row.id,
      "UPDATE",
      { code: row.code, active: row.active },
    );
    return row;
  
        });
  }

  @Delete("api/admin/physio-sites/:id")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const row = await retirePhysioSite(id);
    await recordClinicAudit(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "PhysioSite",
      row.id,
      "RETIRE",
      { code: row.code },
    );
    return row;
  
        });
  }
}
