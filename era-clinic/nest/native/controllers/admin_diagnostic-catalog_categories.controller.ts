import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listDiagnosticCategories, createDiagnosticCategory } from "@/domain/catalog/diagnostic-catalog-admin.service";


const createSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
});

@Controller()
export class AdminDiagnosticCatalogCategoriesController {

  @Get("api/admin/diagnostic-catalog/categories")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listDiagnosticCategories();
  
        });
  }

  @Post("api/admin/diagnostic-catalog/categories")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createDiagnosticCategory(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      body.name,
      body.active,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
