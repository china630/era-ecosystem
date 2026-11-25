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
import { updateAnalyte, deleteAnalyte } from "@/domain/catalog/diagnostic-catalog-admin.service";


const boundKindSchema = z.enum([
  "INTERVAL",
  "UPPER_ONLY",
  "LOWER_ONLY",
  "QUALITATIVE",
  "ZONES",
]);

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  unit: z.string().nullable().optional(),
  labelEn: z.string().min(1).optional(),
  labelRu: z.string().min(1).optional(),
  labelAz: z.string().min(1).optional(),
  normTextEn: z.string().nullable().optional(),
  normTextRu: z.string().nullable().optional(),
  normTextAz: z.string().nullable().optional(),
  boundKind: boundKindSchema.optional(),
  refMin: z.string().nullable().optional(),
  refMax: z.string().nullable().optional(),
  refMinFemale: z.string().nullable().optional(),
  refMaxFemale: z.string().nullable().optional(),
  refMinMale: z.string().nullable().optional(),
  refMaxMale: z.string().nullable().optional(),
  zonesJson: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  valueType: z.enum(["NUMERIC", "QUALITATIVE"]).optional(),
  sortOrder: z.number().int().optional(),
  valueOptions: z
    .array(
      z.object({
        code: z.string().min(1),
        labelEn: z.string().min(1),
        labelRu: z.string().min(1),
        labelAz: z.string().min(1),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});

@Controller()
export class AdminDiagnosticCatalogServicesIdAnalytesAnalyteIdController {

  @Patch("api/admin/diagnostic-catalog/services/:id/analytes/:analyteId")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { analyteId } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateAnalyte(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      analyteId,
      body,
    );
    return row;
  
        });
  }

  @Delete("api/admin/diagnostic-catalog/services/:id/analytes/:analyteId")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { analyteId } = httpReq.params;
    await deleteAnalyte({ userId: guard.session.sub, request: expressKitHeaders(httpReq) }, analyteId);
    return { deleted: true };
  
        });
  }
}
