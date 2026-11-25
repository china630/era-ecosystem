import { Controller, Delete, Get, HttpCode, Patch, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  sendJson,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patientCardDiagnosisWriteDenied } from "@/lib/patient-card-gates";
import { addEpisodeDiagnosis, deleteEpisodeDiagnosis, listEpisodeDiagnoses, updateEpisodeDiagnosis } from "@/domain/icd/diagnosis-write.service";
import { resolveEpisodeForPatient } from "@/domain/sanatorium/episode-resolve";
import { EPISODE_CLOSED, episodeWriteDenied } from "@/domain/sanatorium/episode-gates";


const createSchema = z.object({
  icdCodeId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  episodeId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  icdCodeId: z.string().min(1).optional(),
  note: z.string().max(500).optional().nullable(),
});

@Controller()
export class PatientsIdDiagnosesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/diagnoses")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return clinicBody(denied);

        const { id } = httpReq.params;
    const episodeParam = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    if (!episode) return { items: [], episodeId: null, status: null };
    return {
      items: await listEpisodeDiagnoses(episode.id),
      episodeId: episode.id,
      status: episode.status,
    };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/patients/:id/diagnoses")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

        const { id } = httpReq.params;
    const body = createSchema.parse(httpReq.body);
    const episodeParam =
      body.episodeId ?? new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    const writeDenied = patientCardDiagnosisWriteDenied(
      Boolean(episode && episode.status === "OPEN"),
    );
    if (writeDenied || !episode) {
      throw new HttpException({ error: writeDenied ?? "No open sanatorium episode", ...{
        code: "NO_OPEN_EPISODE",
      } }, 409);
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) throw new HttpException({ error: closed, ...{ code: EPISODE_CLOSED } }, 409);
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
    const row = await addEpisodeDiagnosis(
      episode.id,
      {
        icdCodeId: body.icdCodeId,
        note: body.note,
        recordedByUserId: session!.sub,
        recordedByPractitionerId: await (
          await import("@/lib/auth/session-practitioner")
        ).resolveSessionPractitionerId(session!.sub),
      },
      { userId: session!.sub },
    );
    const { tryOpenProgramAfterTherapistStage } = await import(
      "@/domain/sanatorium/open-program-after-therapist.service"
    );
    let day1Program = null;
    try {
      day1Program = await tryOpenProgramAfterTherapistStage(episode.id);
    } catch (err) {
    if (err instanceof HttpException) throw err;
      console.error("[day1] open program after diagnosis failed", episode.id, err);
    }
    throw new HttpException({ ...row, day1Program }, 201);
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/patients/:id/diagnoses")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

        const { id: patientRefId } = httpReq.params;
    const diagnosisId = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!diagnosisId) throw new HttpException({ error: "id required" }, 400);
    try {
      await deleteEpisodeDiagnosis(diagnosisId, patientRefId, {
        userId: session!.sub,
      });
    } catch (err) {
    if (err instanceof HttpException) throw err;
      if (
        err instanceof Error &&
        err.name === "IcdCatalogError" &&
        (err as Error & { code?: string }).code === "LAST_DIAGNOSIS"
      ) {
        return sendJson(
          httpRes,
          { error: err.message, code: "LAST_DIAGNOSIS" },
          409,
        );
      }
      throw err;
    }
    return { deleted: true };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/patients/:id/diagnoses")
  @HttpCode(200)
  async patch_3(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

        const { id: patientRefId } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateEpisodeDiagnosis(
      body.id,
      patientRefId,
      {
        icdCodeId: body.icdCodeId,
        note: body.note,
      },
      { userId: session!.sub },
    );
    return row;
  
        });
  }
}
