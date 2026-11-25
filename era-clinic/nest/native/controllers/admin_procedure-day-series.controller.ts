import { Controller, Delete, Get, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { deleteDaySeries, listDaySeries, saveDaySeries } from "@/domain/planning/day-series.service";


const bodySchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  fillsRestDays: z.boolean().default(false),
  modeCode: z.string().max(16).nullable().optional(),
  weeklyCap: z.number().int().min(0).max(14).nullable().optional(),
  afternoonPinRetry: z.boolean().optional(),
  members: z.array(z.object({ procedureCode: z.string().min(1), shortMark: z.string().min(1) })).default([]),
});

@Controller()
export class AdminProcedureDaySeriesController {

  @Get("api/admin/procedure-day-series")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listDaySeries();
  
        });
  }

  @Post("api/admin/procedure-day-series")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = bodySchema.parse(httpReq.body);
    return await saveDaySeries(body);
  
        });
  }

  @Delete("api/admin/procedure-day-series")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) throw new HttpException({ error: "id required" }, 400);
    await deleteDaySeries(id);
    return { deleted: true };
  
        });
  }
}
