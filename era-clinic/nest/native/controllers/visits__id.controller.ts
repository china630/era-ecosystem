import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getVisitById } from "@/domain/visit/visit.service";

@Controller()
export class VisitsIdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/visits/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS_READ);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const visit = await getVisitById(id);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
    return visit;
  
        });
  }
}
