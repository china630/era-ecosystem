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
import { listMetaFields, createMetaField } from "@/domain/catalog/diagnostic-catalog-admin.service";


const createSchema = z.object({
  key: z.string().min(1),
  fieldType: z.string().min(1),
  labelEn: z.string().min(1),
  labelRu: z.string().min(1),
  labelAz: z.string().min(1),
  unit: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

@Controller()
export class AdminDiagnosticCatalogMetaFieldsController {

  @Get("api/admin/diagnostic-catalog/meta-fields")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listMetaFields();
  
        });
  }

  @Post("api/admin/diagnostic-catalog/meta-fields")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createMetaField(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
