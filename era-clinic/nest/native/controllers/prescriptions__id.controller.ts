import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPrescriptionForPrint } from "@/domain/prescription/prescription.service";

@Controller()
export class PrescriptionsIdController {
  @UseGuards(ClinicApiGuard)
  @Get("api/prescriptions/:id")
  @HttpCode(200)
  async getOne(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
      if (denied) return clinicBody(denied);
      const { id } = httpReq.params;
      const row = await getPrescriptionForPrint(id);
      if (!row) throw new HttpException({ error: "Prescription not found" }, 404);
      return row;
    });
  }
}