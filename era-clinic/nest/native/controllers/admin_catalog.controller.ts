import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { ServiceCatalogKind } from "@prisma/client";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { resolveDepartmentWrite } from "@/domain/catalog/service-department.service";
import { parseCatalogKindQuery } from "@/domain/catalog/service-catalog-kind";
import { listServiceCatalogAdminRows, findServiceCatalogByCode, createServiceCatalogRow } from "@/lib/services/clinic-master-data.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDayBounds } from "@era/satellite-kit/time";


const writeSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  descriptionAz: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  department: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  kind: z.nativeEnum(ServiceCatalogKind).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

@Controller()
export class AdminCatalogController {

  @Get("api/admin/catalog")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const kinds = parseCatalogKindQuery(url.searchParams.get("kind"));
    const missingListPrice = url.searchParams.get("missingListPrice") === "1";
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : undefined;

    const rows = await listServiceCatalogAdminRows({
      kinds: kinds ?? undefined,
      q: q || undefined,
      limit,
      missingListPrice,
    });
    return rows;
  
        });
  }

  @Post("api/admin/catalog")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = writeSchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const code = body.code.trim();
    const existing = await findServiceCatalogByCode(code);
    if (existing) throw new HttpException({ error: "Code already exists" }, 409);
    const listAmount = body.amount > 0 ? body.amount : null;
    const effectiveFrom = body.effectiveFrom
      ? bakuDayBounds(body.effectiveFrom).start
      : new Date();
    const dept = await resolveDepartmentWrite(organizationId, body);
    const row = await createServiceCatalogRow({
      organizationId,
      code,
      description: body.description.trim(),
      descriptionAz: body.descriptionAz?.trim() || null,
      descriptionRu: body.descriptionRu?.trim() || null,
      descriptionEn: body.descriptionEn?.trim() || null,
      amount: body.amount,
      listAmount,
      department: dept.department,
      departmentCode: dept.departmentCode,
      kind: body.kind ?? "OTHER",
      syncedAt: new Date(),
    });
    await recordCatalogPriceIfChanged({
      organizationId,
      code,
      amount: body.amount,
      listAmount,
      effectiveFrom,
    });
    throw new HttpException(row, 201);
  
        });
  }
}
