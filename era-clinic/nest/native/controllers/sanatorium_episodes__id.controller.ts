import { Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";
import { findEpisodeAnamnesisPatchBase, findEpisodeReservationForProgram, findProgramInstanceForEpisode, updateEpisodeAnamnesis } from "@/domain/sanatorium/episode-resolve";
import { addComplaint, addDiagnosis, closeWalkInEpisode, completeCheckupAndSchedule, createEpisodeLabOrder, getEpisode } from "@/lib/services/sanatorium.service";
import { CARE_TEAM_REQUIRED, episodeCareTeamDenied } from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";


const complaintSchema = z.object({ text: z.string().min(1) });
const diagnosisSchema = z.object({
  icdCodeId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});
const labSchema = z.object({
  testCode: z.string().min(1),
  confirmRepeat: z.boolean().optional(),
});
const instantiateProgramSchema = z.object({
  programCode: z.string().min(1),
  startsOn: z.string().min(1),
});
const completeCheckupSchema = z.object({
  programCode: z.string().min(1).optional(),
  startsOn: z.string().min(1).optional(),
});
const patchSchema = z.object({
  anamnesisText: z.string().max(20000).optional().nullable(),
});

@Controller()
export class SanatoriumEpisodesIdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const episode = await getEpisode(id);
    if (episode?.programInstance?.procedureLines?.length) {
      const { countEntitlementCompleted } = await import(
        "@/domain/sanatorium/entitlement-usage.service"
      );
      const lines = await Promise.all(
        episode.programInstance.procedureLines.map(async (line) => ({
          ...line,
          quotaCompleted: await countEntitlementCompleted({
            episodeId: id,
            quotaCode: line.procedureCode,
          }),
        })),
      );
      episode.programInstance.procedureLines = lines;
    }
    let hotelStay: { startsOn: string; endsOn: string } | null = null;
    if (episode?.reservationId) {
      const window = await lookupHotelStayWindow(episode.reservationId);
      if (window) hotelStay = { startsOn: window.checkInDate, endsOn: window.checkOutDate };
    }
    return episode ? { ...episode, hotelStay } : episode;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/sanatorium/episodes/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const permDenied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (permDenied) return permDenied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = patchSchema.parse(httpReq.body);
    const episode = await findEpisodeAnamnesisPatchBase(id);
    if (!episode) throw new HttpException({ error: "Episode not found" }, 404);
    const { EPISODE_CLOSED, episodeWriteDenied } = await import(
      "@/domain/sanatorium/episode-gates"
    );
    const closed = episodeWriteDenied(episode.status);
    if (closed) throw new HttpException({ error: closed, ...{ code: EPISODE_CLOSED } }, 409);

    if (body.anamnesisText !== undefined) {
      const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(id));
      if (careDenied) {
        throw new HttpException({ error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
      }
    }

    const { resolveSessionPractitionerId } = await import(
      "@/lib/auth/session-practitioner"
    );
    const practitionerId = await resolveSessionPractitionerId(session.sub);

    const data: {
      anamnesisText?: string | null;
      anamnesisUpdatedAt?: Date | null;
      anamnesisByPractitionerId?: string | null;
    } = {};
    if (body.anamnesisText !== undefined) {
      const trimmed = body.anamnesisText?.trim() || null;
      data.anamnesisText = trimmed;
      data.anamnesisUpdatedAt = trimmed ? new Date() : null;
      if (!trimmed) {
        data.anamnesisByPractitionerId = null;
      } else if (!episode.anamnesisByPractitionerId && practitionerId) {
        // Stamp author only on first write; later edits keep original doctor.
        data.anamnesisByPractitionerId = practitionerId;
      }
    }
    const updated = await updateEpisodeAnamnesis(id, data);
    if (body.anamnesisText !== undefined) {
      const { recordEpisodeAudit } = await import(
        "@/domain/sanatorium/episode-audit.service"
      );
      await recordEpisodeAudit({ userId: session.sub }, id, "anamnesis_update", {
        summary: updated.anamnesisText?.trim()
          ? "anamnesis saved"
          : "anamnesis cleared",
        length: updated.anamnesisText?.length ?? 0,
      });
    }

    let day1Program: Awaited<
      ReturnType<
        typeof import("@/domain/sanatorium/open-program-after-therapist.service").tryOpenProgramAfterTherapistStage
      >
    > | null = null;
    if (body.anamnesisText !== undefined && updated.anamnesisText?.trim()) {
      try {
        const { tryOpenProgramAfterTherapistStage } = await import(
          "@/domain/sanatorium/open-program-after-therapist.service"
        );
        day1Program = await tryOpenProgramAfterTherapistStage(id);
      } catch (err) {
    if (err instanceof HttpException) throw err;
        day1Program = {
          opened: false,
          reason: "INSTANTIATE_FAILED",
        };
        console.error("[day1] open program after anamnesis failed", id, err);
      }
    }

    return { ...updated, day1Program };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id")
  @HttpCode(200)
  async post_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const { id } = httpReq.params;
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const permDenied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (permDenied) return permDenied;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const action = url.searchParams.get("action");
    const rawBody = typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "");
    const body = rawBody ? JSON.parse(rawBody) : {};

    const clinicalActions = new Set([
      "complaint",
      "diagnosis",
      "lab",
      "instantiate-program",
      "complete-checkup",
    ]);
    if (action && clinicalActions.has(action)) {
      const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(id));
      if (careDenied) {
        throw new HttpException({ error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
      }
    }

    if (action === "complaint") {
      const parsed = complaintSchema.parse(body);
      const { resolveSessionPractitionerId } = await import(
        "@/lib/auth/session-practitioner"
      );
      const row = await addComplaint(id, parsed.text, {
        recordedByPractitionerId: await resolveSessionPractitionerId(session.sub),
      });
      let day1Program = null;
      try {
        const { tryOpenProgramAfterTherapistStage } = await import(
          "@/domain/sanatorium/open-program-after-therapist.service"
        );
        day1Program = await tryOpenProgramAfterTherapistStage(id);
      } catch (err) {
    if (err instanceof HttpException) throw err;
        console.error("[day1] open program after complaint failed", id, err);
      }
      return { ...row, day1Program };
    }
    if (action === "diagnosis") {
      const parsed = diagnosisSchema.parse(body);
      return await addDiagnosis(id, {
          ...parsed,
          recordedByUserId: session.sub,
          recordedByPractitionerId: await (
            await import("@/lib/auth/session-practitioner")
          ).resolveSessionPractitionerId(session.sub),
        });
    }
    if (action === "lab") {
      const parsed = labSchema.parse(body);
      return await createEpisodeLabOrder(id, parsed.testCode, {
          confirmRepeat: parsed.confirmRepeat,
        });
    }
    if (action === "instantiate-program") {
      const parsed = instantiateProgramSchema.parse(body);
      const existing = await findProgramInstanceForEpisode(id);
      if (existing) throw new HttpException({ error: "Program already assigned" }, 409);
      const episode = await findEpisodeReservationForProgram(id);
      if (!episode) throw new HttpException({ error: "Episode not found" }, 404);
      const { procedureLaneDenial } = await import("@/domain/sanatorium/lane-gates");
      const denied = await procedureLaneDenial(id);
      if (denied) throw new HttpException({ error: denied.message, ...{ code: denied.code } }, 409);
      const instance = await instantiateProgramFromTemplate({
        episodeId: id,
        programCode: parsed.programCode,
        reservationId: episode.reservationId ?? undefined,
        startsOn: new Date(parsed.startsOn),
      });
      return instance;
    }
    if (action === "complete-checkup") {
      const parsed = completeCheckupSchema.parse(body);
      return await completeCheckupAndSchedule({
          episodeId: id,
          programCode: parsed.programCode,
          startsOn: parsed.startsOn ? new Date(parsed.startsOn) : undefined,
        });
    }
    if (action === "close") {
      return await closeWalkInEpisode(id);
    }

    throw new HttpException({ error: "Unknown action" }, 400);
  
        });
  }
}
