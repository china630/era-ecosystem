import { Controller, Delete, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { departmentFallbackLabel, getServiceDepartmentById, updateServiceDepartmentRow, syncCatalogDepartmentLabels, countServiceCatalogForDepartment, deleteServiceDepartmentRow } from "@/domain/catalog/service-department.service";


const patchSchema = z.object({
  code: z.string().min(1).optional(),
  nameAz: z.string().optional().nullable(),
  nameRu: z.string().optional().nullable(),
  nameEn: z.string().optional().nullable(),
  active: z.boolean().optional(),
  hotelRevenueCode: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

@Controller()
export class AdminDepartmentsIdController {

  @Patch("api/admin/departments/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getServiceDepartmentById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    const body = patchSchema.parse(httpReq.body);
    const row = await updateServiceDepartmentRow(id, {
      ...(body.code != null ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.nameAz !== undefined ? { nameAz: body.nameAz?.trim() || null } : {}),
      ...(body.nameRu !== undefined ? { nameRu: body.nameRu?.trim() || null } : {}),
      ...(body.nameEn !== undefined ? { nameEn: body.nameEn?.trim() || null } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.hotelRevenueCode !== undefined
        ? { hotelRevenueCode: body.hotelRevenueCode?.trim() || null }
        : {}),
    });
    const label = departmentFallbackLabel(row);
    await syncCatalogDepartmentLabels(row.code, label);
    return row;
  
        });
  }

  @Delete("api/admin/departments/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getServiceDepartmentById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    const serviceCount = await countServiceCatalogForDepartment(
      existing.organizationId,
      existing.code,
    );
    if (serviceCount > 0) {
      throw new HttpException({ error: "Department still has services", ...{
        code: "DEPARTMENT_IN_USE",
        serviceCount,
      } }, 409);
    }
    await deleteServiceDepartmentRow(id);
    return { id };
  
        });
  }
}
