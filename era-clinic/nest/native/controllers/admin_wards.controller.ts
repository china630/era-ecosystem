import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listWards, createWard } from "@/domain/inpatient/ward.service";
import { z } from "zod";


const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  dailyChargeCode: z.string().optional(),
});

@Controller()
export class AdminWardsController {

  @Get("api/admin/wards")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const wards = await listWards();
    return { data: wards };
  
        });
  }

  @Post("api/admin/wards")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const ward = await createWard(body);
    throw new HttpException({ data: ward }, 201);
  
        });
  }
}
