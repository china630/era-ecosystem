import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listPractitioners, purgeNonClinicalPractitioners } from "@/lib/services/clinic-master-data.service";


/** v3 clean cutover — practitioner hire only via CP Workforce (Plan E). */

@Controller()
export class AdminPractitionersController {

  @UseGuards(ClinicApiGuard)
  @Get("api/admin/practitioners")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const staffKind = url.searchParams.get("staffKind");
    const kind =
      staffKind === "DOCTOR" ||
      staffKind === "NURSE" ||
      staffKind === "LAB" ||
      staffKind === "BATH" ||
      staffKind === "MASSAGE"
        ? staffKind
        : undefined;
    await purgeNonClinicalPractitioners();
    return await listPractitioners(kind, {
        includeInactive: url.searchParams.get("includeInactive") === "1",
      });
  
        });
  }

  @Post("api/admin/practitioners")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);

    throw new HttpException({ error: 
      "Hire practitioners in ERA Workspace → Workforce (Security Admin / Employments). SatAdmin can edit staff kind and skills only.", ...{ code: "WORKFORCE_HIRE_VIA_CP" } }, 403);
  
        });
  }
}
