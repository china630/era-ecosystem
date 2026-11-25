import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listPrescriptionsForPatient } from "@/domain/prescription/prescription.service";

@Controller()
export class PatientsIdPrescriptionsController {
  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/prescriptions")
  @HttpCode(200)
  async getList(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
      if (denied) return clinicBody(denied);
      const { id } = httpReq.params;
      return { items: await listPrescriptionsForPatient(id) };
    });
  }
}