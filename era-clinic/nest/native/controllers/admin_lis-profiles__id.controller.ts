import { Controller, Delete, Get, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getLisFileProfileById, updateLisFileProfile, deleteLisFileProfile } from "@/lib/services/clinic-master-data.service";


const patchSchema = z.object({
  name: z.string().min(1).optional(),
  format: z.enum(["CSV", "HL7_FRAGMENT"]).optional(),
  delimiter: z.string().optional(),
  columnMapping: z.record(z.string()).optional(),
});

@Controller()
export class AdminLisProfilesIdController {

  @Get("api/admin/lis-profiles/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const profile = await getLisFileProfileById(id);
    if (!profile) throw new HttpException({ error: "Profile not found" }, 404);
    return profile;
  
        });
  }

  @Patch("api/admin/lis-profiles/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const profile = await updateLisFileProfile(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.format !== undefined ? { format: body.format } : {}),
      ...(body.delimiter !== undefined ? { delimiter: body.delimiter } : {}),
      ...(body.columnMapping !== undefined
        ? { columnMappingJson: JSON.stringify(body.columnMapping) }
        : {}),
    });
    return profile;
  
        });
  }

  @Delete("api/admin/lis-profiles/:id")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteLisFileProfile(id);
    return { deleted: true };
  
        });
  }
}
