import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { submitPatientFormResponse } from "@/domain/forms/patient-form.service";
import { assertPatientConsentSigned, CONSENT_REQUIRED_CODE } from "@/domain/forms/consent-required";
import { requestOrganizationId } from "@/lib/request-organization";

const bodySchema = z.object({
  templateCode: z.string().min(2),
  patientRefId: z.string().min(1),
  appointmentId: z.string().optional(),
  answersJson: z.string().min(2),
  signed: z.boolean().optional(),
});

const checkSchema = z.object({
  patientRefId: z.string().min(1),
  templateCode: z.string().optional(),
  appointmentId: z.string().optional(),
});

@Controller()
export class PatientFormResponsesController {
  @UseGuards(ClinicApiGuard)
  @Post("api/patient-forms/responses")
  @HttpCode(200)
  async postResponse(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_WRITE);
      if (denied) return clinicBody(denied);
      const body = bodySchema.parse(httpReq.body);
      return submitPatientFormResponse(body);
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/patient-forms/consent-check")
  @HttpCode(200)
  async postConsentCheck(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
      if (denied) return clinicBody(denied);
      const body = checkSchema.parse(httpReq.body);
      const organizationId = requestOrganizationId();
      const result = await assertPatientConsentSigned({
        organizationId,
        patientRefId: body.patientRefId,
        templateCode: body.templateCode ?? "",
        appointmentId: body.appointmentId,
      });
      if (!result.ok) {
        throw new HttpException(
          { error: CONSENT_REQUIRED_CODE, code: CONSENT_REQUIRED_CODE, missing: result.missing },
          409,
        );
      }
      return { ok: true };
    });
  }
}