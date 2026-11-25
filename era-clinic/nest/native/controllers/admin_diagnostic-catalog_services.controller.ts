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
import { listServices, createService } from "@/domain/catalog/diagnostic-catalog-admin.service";


const fieldDefSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  label: z.object({ en: z.string(), ru: z.string(), az: z.string() }),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const createSchema = z.object({
  code: z.string().min(1),
  modalityId: z.string().min(1),
  category: z.string().optional(),
  kind: z.string().min(1),
  titleEn: z.string().min(1),
  titleRu: z.string().min(1),
  titleAz: z.string().min(1),
  serviceCode: z.string().min(1),
  financeSku: z.string().nullable().optional(),
  fields: z.array(fieldDefSchema).nullable().optional(),
  includes: z.array(z.string()).nullable().optional(),
  guestBlankRelease: z.enum(["PAY_WITH_WORK", "AFTER_PAYMENT"]).optional(),
  menuSurface: z.enum(["LAB", "DIAGNOSTIC", "VISIT"]).nullable().optional(),
  autoPaidOnOpen: z.boolean().optional(),
  schedulingMode: z.enum(["FIXED", "OPEN"]).optional(),
  broughtInMaxDays: z.number().int().min(1).max(365).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  packageOnly: z.boolean().optional(),
});

@Controller()
export class AdminDiagnosticCatalogServicesController {

  @Get("api/admin/diagnostic-catalog/services")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const modalityId = url.searchParams.get("modalityId") ?? undefined;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    return await listServices({ modalityId, includeInactive });
  
        });
  }

  @Post("api/admin/diagnostic-catalog/services")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createService(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
