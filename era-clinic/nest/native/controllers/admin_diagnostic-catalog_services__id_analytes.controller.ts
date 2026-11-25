import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listAnalytes, createAnalyte } from "@/domain/catalog/diagnostic-catalog-admin.service";
import { alignUrinePanel } from "@/domain/lab/urine-blank";


const boundKindSchema = z.enum([
  "INTERVAL",
  "UPPER_ONLY",
  "LOWER_ONLY",
  "QUALITATIVE",
  "ZONES",
]);

const createSchema = z.object({
  code: z.string().min(1),
  unit: z.string().nullable().optional(),
  labelEn: z.string().min(1),
  labelRu: z.string().min(1),
  labelAz: z.string().min(1),
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
export class AdminDiagnosticCatalogServicesIdAnalytesController {

  @Get("api/admin/diagnostic-catalog/services/:id/analytes")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await alignUrinePanel(id);
    return await listAnalytes(id);
  
        });
  }

  @Post("api/admin/diagnostic-catalog/services/:id/analytes")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = createSchema.parse(httpReq.body);
    const row = await createAnalyte(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      id,
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
