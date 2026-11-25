import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateDiagnosticCategory } from "@/domain/catalog/diagnostic-catalog-admin.service";


const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

@Controller()
export class AdminDiagnosticCatalogCategoriesIdController {

  @Patch("api/admin/diagnostic-catalog/categories/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updateDiagnosticCategory(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      id,
      body,
    );
    return row;
  
        });
  }
}
