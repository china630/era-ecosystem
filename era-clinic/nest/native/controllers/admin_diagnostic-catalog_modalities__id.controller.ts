import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Delete, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateModality, deleteModality } from "@/domain/catalog/diagnostic-catalog-admin.service";


const updateSchema = z.object({
  code: z.string().min(1).optional(),
  kind: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleAz: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  hotelRevenueCode: z.string().nullable().optional(),
});

@Controller()
export class AdminDiagnosticCatalogModalitiesIdController {

  @Patch("api/admin/diagnostic-catalog/modalities/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateModality(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      id,
      body,
    );
    return row;
  
        });
  }

  @Delete("api/admin/diagnostic-catalog/modalities/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteModality({ userId: guard.session.sub, request: expressKitHeaders(httpReq) }, id);
    return { deleted: true };
  
        });
  }
}
