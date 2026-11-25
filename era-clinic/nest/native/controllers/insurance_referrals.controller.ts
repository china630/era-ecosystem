import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  listInsuranceReferrals,
  registerInsuranceReferral,
} from "@/domain/insurance/insurance-referral.service";
import { requireClinicModule } from "@/lib/clinic-module-gate";
import { requestOrganizationId } from "@/lib/request-organization";

const createSchema = z.object({
  patientRefId: z.string().min(1),
  policyId: z.string().optional(),
  source: z.enum(["E_TABIB", "INSURER", "MANUAL"]),
  referralCode: z.string().min(4),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  allowedServiceCodes: z.array(z.string()).optional(),
});

@Controller()
export class InsuranceReferralsController {
  @UseGuards(ClinicApiGuard)
  @Get("api/insurance/referrals")
  @HttpCode(200)
  async getList(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
      if (denied) return clinicBody(denied);
      await requireClinicModule("clinic_insurance", requestOrganizationId());
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const patientRefId = url.searchParams.get("patientRefId") ?? undefined;
      return { items: await listInsuranceReferrals(patientRefId) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/insurance/referrals")
  @HttpCode(200)
  async postCreate(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_WRITE);
      if (denied) return clinicBody(denied);
      await requireClinicModule("clinic_insurance", requestOrganizationId());
      const body = createSchema.parse(httpReq.body);
      const result = await registerInsuranceReferral(body);
      if (result.kind === "rejected") {
        throw new HttpException({ error: result.code, code: result.code }, 409);
      }
      return result.referral;
    });
  }
}