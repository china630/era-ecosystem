import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listServiceDepartments, createServiceDepartmentRow } from "@/domain/catalog/service-department.service";
import { requestOrganizationId } from "@/lib/request-organization";


const createSchema = z.object({
  code: z.string().min(1),
  nameAz: z.string().optional().nullable(),
  nameRu: z.string().optional().nullable(),
  nameEn: z.string().optional().nullable(),
  hotelRevenueCode: z.string().nullable().optional(),
});

@Controller()
export class AdminDepartmentsController {

  @Get("api/admin/departments")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const rows = await listServiceDepartments();
    return rows;
  
        });
  }

  @Post("api/admin/departments")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createServiceDepartmentRow({
      organizationId: requestOrganizationId(),
      code: body.code.trim().toUpperCase(),
      nameAz: body.nameAz?.trim() || null,
      nameRu: body.nameRu?.trim() || null,
      nameEn: body.nameEn?.trim() || null,
      hotelRevenueCode: body.hotelRevenueCode?.trim() || null,
    });
    throw new HttpException(row, 201);
  
        });
  }
}
