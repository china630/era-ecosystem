import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { createBed, listBedsByWard } from "@/domain/inpatient/ward.service";
import { z } from "zod";


const createSchema = z.object({
  code: z.string().min(1),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
});

@Controller()
export class AdminWardsIdBedsController {

  @Get("api/admin/wards/:id/beds")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const beds = await listBedsByWard(id);
    return { data: beds };
  
        });
  }

  @Post("api/admin/wards/:id/beds")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id: wardId } = httpReq.params;
    const body = createSchema.parse(httpReq.body);
    const bed = await createBed({ wardId, code: body.code, status: body.status });
    throw new HttpException({ data: bed }, 201);
  
        });
  }
}
