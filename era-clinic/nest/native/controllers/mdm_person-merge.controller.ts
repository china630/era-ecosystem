import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { mergePersonRecords } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";


const schema = z.object({
  patientRefId: z.string(),
  sourcePersonId: z.string().uuid(),
  targetPersonId: z.string().uuid(),
  fin: z.string().trim().min(7),
  fullName: z.string().trim().min(1),
});

/** Ops: foreigner received FIN — merge MDM records and re-link patient. */

@Controller()
export class MdmPersonMergeController {

  @UseGuards(ClinicApiGuard)
  @Post("api/mdm/person-merge")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM);
    if (denied) return clinicBody(denied);

    const body = schema.parse(httpReq.body);
    const merged = await mergePersonRecords(body.sourcePersonId, body.targetPersonId);
    if (!merged.globalPersonId) {
      throw new HttpException({ error: "MDM merge failed" }, 502);
    }
    await linkPatientGlobalPerson({
      patientRefId: body.patientRefId,
      fin: body.fin,
      fullName: body.fullName,
    });
    return { globalPersonId: merged.globalPersonId };
  
        });
  }
}
