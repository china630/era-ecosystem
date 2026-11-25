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
import { listModalities, createModality } from "@/domain/catalog/diagnostic-catalog-admin.service";


const createSchema = z.object({
  code: z.string().min(1),
  kind: z.string().min(1),
  titleEn: z.string().min(1),
  titleRu: z.string().min(1),
  titleAz: z.string().min(1),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  hotelRevenueCode: z.string().nullable().optional(),
});

@Controller()
export class AdminDiagnosticCatalogModalitiesController {

  @Get("api/admin/diagnostic-catalog/modalities")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const includeInactive =
      new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("includeInactive") === "true";
    return await listModalities({ includeInactive });
  
        });
  }

  @Post("api/admin/diagnostic-catalog/modalities")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createModality(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
