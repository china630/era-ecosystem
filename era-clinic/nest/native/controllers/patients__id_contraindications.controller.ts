import { Controller, Delete, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { activeBodyPartCodes } from "@/domain/catalog/body-part-lookup";
import { listPatientContraindications, findPatientContraindicationForDelete, deletePatientContraindication, findClinicalEpisodeForPatient, createPatientContraindication } from "@/domain/patient/patient.service";
import { EPISODE_CLOSED, episodeWriteDenied, NO_OPEN_EPISODE } from "@/domain/sanatorium/episode-gates";


const bodySchema = z.object({
  bodyPart: z.string().min(1),
  note: z.string().optional(),
  episodeId: z.string().min(1),
});

@Controller()
export class PatientsIdContraindicationsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/contraindications")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const episodeId = url.searchParams.get("episode");
    const rows = await listPatientContraindications(id, episodeId);
    return rows;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/patients/:id/contraindications")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

    const { id: patientRefId } = httpReq.params;
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const rowId = url.searchParams.get("id");
    if (!rowId) throw new HttpException({ error: "id required" }, 400);
    const existing = await findPatientContraindicationForDelete(patientRefId, rowId);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    if (existing.episodeId) {
      const closed = episodeWriteDenied(existing.episode?.status);
      if (closed) throw new HttpException({ error: closed, ...{ code: EPISODE_CLOSED } }, 409);
    }
    await deletePatientContraindication(patientRefId, rowId, {
      userId: session!.sub,
    });
    return { ok: true };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/patients/:id/contraindications")
  @HttpCode(200)
  async post_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const allowedParts = await activeBodyPartCodes();
    if (!allowedParts.has(body.bodyPart.trim().toUpperCase())) {
      throw new HttpException({ error: "Unknown body part" }, 400);
    }
    const episode = await findClinicalEpisodeForPatient(body.episodeId, id);
    if (!episode) {
      throw new HttpException({ error: "Episode not found for patient", ...{ code: NO_OPEN_EPISODE } }, 404);
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) {
      throw new HttpException({ error: closed, ...{ code: EPISODE_CLOSED } }, 409);
    }
    const {
      CARE_TEAM_REQUIRED,
      episodeCareTeamDenied,
    } = await import("@/domain/sanatorium/episode-care-team-gates");
    const { countEpisodeCareDoctors } = await import(
      "@/domain/sanatorium/episode-care-team.service"
    );
    const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episode.id));
    if (careDenied) {
      throw new HttpException({ error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
    }
    const row = await createPatientContraindication(
      {
        patientRefId: id,
        episodeId: episode.id,
        bodyPart: body.bodyPart,
        note: body.note,
      },
      { userId: session!.sub },
    );
    throw new HttpException(row, 201);
  
        });
  }
}
