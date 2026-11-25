import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { getClinicWorkforcePolicy } from "@/lib/workforce-policy";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";

@Controller()
export class AdminWorkforcePolicyController {

  @Get("api/admin/workforce-policy")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const policy = await getClinicWorkforcePolicy();
    return { data: policy };
  
        });
  }
}
