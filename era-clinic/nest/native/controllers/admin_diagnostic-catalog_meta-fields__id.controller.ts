import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateMetaField } from "@/domain/catalog/diagnostic-catalog-admin.service";


const updateSchema = z.object({
  key: z.string().min(1).optional(),
  fieldType: z.string().min(1).optional(),
  labelEn: z.string().min(1).optional(),
  labelRu: z.string().min(1).optional(),
  labelAz: z.string().min(1).optional(),
  unit: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

@Controller()
export class AdminDiagnosticCatalogMetaFieldsIdController {

  @Patch("api/admin/diagnostic-catalog/meta-fields/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateMetaField(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      id,
      body,
    );
    return row;
  
        });
  }
}
