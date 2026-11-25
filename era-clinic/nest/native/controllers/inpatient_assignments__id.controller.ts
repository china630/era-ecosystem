import { Controller, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dischargeAdmission } from "@/domain/inpatient/adt.service";
import { getBedAssignmentDischargeMeta } from "@/domain/patient/patient.service";

@Controller()
export class InpatientAssignmentsIdController {

  @UseGuards(ClinicApiGuard)
  @Patch("api/inpatient/assignments/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const assignment = await getBedAssignmentDischargeMeta(id);
    if (!assignment) throw new HttpException({ error: "Assignment not found" }, 404);
    if (assignment.dischargedAt) throw new HttpException({ error: "Already discharged" }, 400);
    if (!assignment.admissionId) throw new HttpException({ error: "Admission not linked" }, 400);
    const admission = await dischargeAdmission(assignment.admissionId);
    return admission;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg.includes("not found")) throw new HttpException({ error: msg }, 404);
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
