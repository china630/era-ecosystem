import { Controller, Delete, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { deleteImagingPhrase, updateImagingPhrase } from "@/domain/catalog/imaging-phrase.service";


const updateSchema = z.object({
  organKey: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  textEn: z.string().min(1).optional(),
  textRu: z.string().min(1).optional(),
  textAz: z.string().min(1).optional(),
  measurementKeys: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

@Controller()
export class AdminDiagnosticCatalogImagingPhrasesIdController {

  @Patch("api/admin/diagnostic-catalog/imaging-phrases/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    return await updateImagingPhrase(id, body);
  
        });
  }

  @Delete("api/admin/diagnostic-catalog/imaging-phrases/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteImagingPhrase(id);
    return { deleted: true };
  
        });
  }
}
