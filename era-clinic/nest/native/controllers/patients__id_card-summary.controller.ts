import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPatientCardSummary } from "@/domain/patient/patient-card.service";
import { findPatientRefId } from "@/domain/patient/patient.service";
import { readUiLocale } from "@/lib/request-locale";

@Controller()
export class PatientsIdCardSummaryController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/card-summary")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return clinicBody(denied);

        const { id } = httpReq.params;
    if (!(await findPatientRefId(id))) throw new HttpException({ error: "Not found" }, 404);
    const episodeId = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("episode") ?? undefined;
    const locale = await readUiLocale(clinicRoute(httpReq));
    return await getPatientCardSummary(id, { episodeId, locale });
  
        });
  }
}
