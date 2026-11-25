import { Controller, Delete, Get, HttpCode, Patch, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveEpisodeForPatient } from "@/domain/sanatorium/episode-resolve";
import { EPISODE_CLOSED, episodeWriteDenied } from "@/domain/sanatorium/episode-gates";
import { addComplaint, deleteEpisodeComplaint, listEpisodeComplaints, updateEpisodeComplaint } from "@/lib/services/sanatorium.service";


const createSchema = z.object({
  text: z.string().min(1).max(2000),
  episodeId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

@Controller()
export class PatientsIdComplaintsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/complaints")
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
      items: await listEpisodeComplaints(episode.id),
      episodeId: episode.id,
      status: episode.status,
    };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/patients/:id/complaints")
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
    if (!episode) {
      throw new HttpException({ error: "No sanatorium episode", ...{ code: "NO_OPEN_EPISODE" } }, 409);
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
    const row = await addComplaint(
      episode.id,
      body.text,
      {
        recordedByPractitionerId: await (
          await import("@/lib/auth/session-practitioner")
        ).resolveSessionPractitionerId(session!.sub),
      },
      { userId: session!.sub },
    );
    let day1Program = null;
    try {
      const { tryOpenProgramAfterTherapistStage } = await import(
        "@/domain/sanatorium/open-program-after-therapist.service"
      );
      day1Program = await tryOpenProgramAfterTherapistStage(episode.id);
    } catch (err) {
    if (err instanceof HttpException) throw err;
      console.error("[day1] open program after complaint failed", episode.id, err);
    }
    throw new HttpException({ ...row, day1Program }, 201);
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/patients/:id/complaints")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

        const { id: patientRefId } = httpReq.params;
    const complaintId = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!complaintId) throw new HttpException({ error: "id required" }, 400);
    await deleteEpisodeComplaint(complaintId, patientRefId, {
      userId: session!.sub,
    });
    return { deleted: true };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/patients/:id/complaints")
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
    const row = await updateEpisodeComplaint(body.id, patientRefId, body.text, {
      userId: session!.sub,
    });
    return row;
  
        });
  }
}
