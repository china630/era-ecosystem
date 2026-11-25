import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestHeader,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { financeEligibilityCheck } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";


const bodySchema = z.object({
  counterpartyId: z.string().uuid().optional(),
  policyNumber: z.string().optional(),
  patientFin: z.string().optional(),
});

@Controller()
export class InsuranceCheckController {

  @UseGuards(ClinicApiGuard)
  @Post("api/insurance/check")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return clinicBody(denied);

    const body = bodySchema.parse(httpReq.body);
    const result = await financeEligibilityCheck(body, {
      authHeader: nestHeader(httpReq, "authorization"),
    });
    return result;
  
        });
  }
}
