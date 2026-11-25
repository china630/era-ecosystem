import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp, clinicRoute, clinicBody } from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { createDietTable, listDietTables } from "@/domain/diet/diet.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().min(1),
  titleAz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  description: z.string().optional().nullable(),
});

@Controller()
export class AdminDietTablesController {
  @Get("api/admin/diet-tables")
  @HttpCode(200)
  async list(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const includeInactive = url.searchParams.get("includeInactive") === "1";
      return { items: await listDietTables(includeInactive) };
    });
  }

  @Post("api/admin/diet-tables")
  @HttpCode(201)
  async create(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const body = createSchema.parse(httpReq.body);
      const row = await createDietTable({
        organizationId: requestOrganizationId(),
        ...body,
      });
      throw new HttpException({ data: row }, 201);
    });
  }
}