import { Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createInsurancePolicy, listInsurancePolicies } from "@/domain/insurance/insurance-policy.service";
import { requireClinicModule } from "@/lib/clinic-module-gate";
import { requestOrganizationId } from "@/lib/request-organization";

const createSchema = z.object({
  patientRefId: z.string().min(1),
  payerKind: z.enum(["ITS", "DMS", "CORPORATE", "PATIENT"]),
  payerCounterpartyId: z.string().optional(),
  policyNumber: z.string().min(1),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  programCode: z.string().optional(),
});

@Controller()
export class InsurancePoliciesController {
  @UseGuards(ClinicApiGuard)
  @Get("api/insurance/policies")
  @HttpCode(200)
  async getList(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
      if (denied) return clinicBody(denied);
      await requireClinicModule("clinic_insurance", requestOrganizationId());
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const patientRefId = url.searchParams.get("patientRefId") ?? undefined;
      return { items: await listInsurancePolicies(patientRefId) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/insurance/policies")
  @HttpCode(200)
  async postCreate(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_WRITE);
      if (denied) return clinicBody(denied);
      await requireClinicModule("clinic_insurance", requestOrganizationId());
      const body = createSchema.parse(httpReq.body);
      const row = await createInsurancePolicy(body);
      return row;
    });
  }
}