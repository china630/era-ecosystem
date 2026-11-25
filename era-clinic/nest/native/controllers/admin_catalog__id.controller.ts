import { Controller, Delete, Get, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
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
import { getServiceCatalogById, listServiceCatalogPricesByCatalogId, updateServiceCatalogRow, deleteServiceCatalogIfUnused } from "@/lib/services/clinic-master-data.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDayBounds } from "@era/satellite-kit/time";


const patchSchema = z.object({
  description: z.string().min(1).optional(),
  descriptionAz: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional(),
  department: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  kind: z.nativeEnum(ServiceCatalogKind).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

@Controller()
export class AdminCatalogIdController {

  @Get("api/admin/catalog/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const row = await getServiceCatalogById(id);
    if (!row) throw new HttpException({ error: "Not found" }, 404);
    const prices = await listServiceCatalogPricesByCatalogId(id);
    return { ...row, prices };
  
        });
  }

  @Patch("api/admin/catalog/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getServiceCatalogById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    const body = patchSchema.parse(httpReq.body);
    const amount = body.amount ?? Number(existing.amount);
    const listAmount =
      body.amount != null
        ? amount > 0
          ? amount
          : null
        : existing.listAmount == null
          ? null
          : Number(existing.listAmount);
    const effectiveFrom = body.effectiveFrom
      ? bakuDayBounds(body.effectiveFrom).start
      : new Date();
    const dept =
      body.departmentCode !== undefined || body.department !== undefined
        ? await resolveDepartmentWrite(existing.organizationId || requestOrganizationId(), {
            departmentCode: body.departmentCode,
            department: body.department,
          })
        : null;
    const row = await updateServiceCatalogRow(id, {
      ...(body.description != null ? { description: body.description.trim() } : {}),
      ...(body.descriptionAz !== undefined ? { descriptionAz: body.descriptionAz?.trim() || null } : {}),
      ...(body.descriptionRu !== undefined ? { descriptionRu: body.descriptionRu?.trim() || null } : {}),
      ...(body.descriptionEn !== undefined ? { descriptionEn: body.descriptionEn?.trim() || null } : {}),
      ...(body.amount != null
        ? { amount: body.amount, listAmount, packageIncluded: false }
        : {}),
      ...(dept
        ? { department: dept.department, departmentCode: dept.departmentCode }
        : {}),
      ...(body.kind != null ? { kind: body.kind } : {}),
      syncedAt: new Date(),
    });
    await recordCatalogPriceIfChanged({
      organizationId: existing.organizationId || requestOrganizationId(),
      code: existing.code,
      amount,
      listAmount,
      effectiveFrom,
    });
    return row;
  
        });
  }

  @Delete("api/admin/catalog/:id")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const result = await deleteServiceCatalogIfUnused(id);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") throw new HttpException({ error: "Not found" }, 404);
      throw new HttpException({ error: "Catalog price is referenced by orders" }, 409);
    }
    return { id };
  
        });
  }
}
