import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { issueGuestQrToken } from "@era/satellite-kit";
import { findPatientRefForGuestQr } from "@/domain/patient/patient.service";

@Controller()
export class IdentityGuestQrController {

  @UseGuards(ClinicApiGuard)
  @Post("api/identity/guest-qr")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_IDENTITY_GUEST_QR,
    );
    if (denied) return clinicBody(denied);

    const body = (httpReq.body) as { patientRefId?: string };
    if (!body.patientRefId) {
      throw new HttpException({ error: "patientRefId required" }, 400);
    }
    const patient = await findPatientRefForGuestQr(body.patientRefId);
    if (!patient?.globalPersonId) {
      throw new HttpException({ error: "globalPersonId not linked" }, 400);
    }
    const issued = await issueGuestQrToken(patient.globalPersonId);
    if (!issued) {
      throw new HttpException({ error: "issue failed" }, 502);
    }
    return {
      globalPersonId: patient.globalPersonId,
      ...issued,
    };
  
        });
  }
}
