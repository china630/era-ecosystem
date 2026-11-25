import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listPatientEpisodes } from "@/domain/sanatorium/episode-resolve";
import { loadLaneGate } from "@/domain/sanatorium/lane-gates";
import { findPatientRefId } from "@/domain/patient/patient.service";

@Controller()
export class PatientsIdEpisodesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/episodes")
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
    return { items: await listPatientEpisodes(id), laneGate: await loadLaneGate() };
  
        });
  }
}
