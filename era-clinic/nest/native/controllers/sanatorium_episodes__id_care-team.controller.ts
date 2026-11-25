import { Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { jsonError, getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { addEpisodeCareDoctor, countEpisodeCareDoctors, listEpisodeCareDoctors, removeEpisodeCareDoctor } from "@/domain/sanatorium/episode-care-team.service";
import { findEpisodeOrganizationId, findProgramInstanceAutoApplyState, listActiveDoctorPractitioners } from "@/domain/sanatorium/episode-resolve";
import { EPISODE_CLOSED } from "@/domain/sanatorium/episode-gates";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";


const addSchema = z.object({
  practitionerId: z.string().min(1),
});

/**
 * First care-team assign requires scope ALL (reception/admin).
 * Later adds: assigned doctor already on the team (or ALL).
 */
async function assertCareTeamMutateAccess(
  session: NonNullable<Awaited<ReturnType<typeof getSatelliteSession>>>,
  episodeId: string,
): Promise<Response | null> {
  const scope = await resolveClinicDataScope(
    session,
    CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
  );
  if (scope.mode === "ALL") return null;

  const count = await countEpisodeCareDoctors(episodeId);
  if (count === 0) {
    return clinicBody(jsonError("Episode not found", 404));
  }
  return assertEpisodeDataScope(session, episodeId);
}

@Controller()
export class SanatoriumEpisodesIdCareTeamController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id/care-team")
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

    const episode = await findEpisodeOrganizationId(id);
    if (!episode) throw new HttpException({ error: "Episode not found" }, 404);

    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode !== "ALL") {
      const scopeDenied = await assertEpisodeDataScope(session, id);
      if (scopeDenied) return clinicBody(scopeDenied);
    }

    const items = await listEpisodeCareDoctors(id);
    const taken = new Set(items.map((i) => i.practitionerId));
    const docs = await listActiveDoctorPractitioners(episode.organizationId);
    const candidates = docs.filter((d) => !taken.has(d.id));

    return { items, candidates };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/care-team")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const accessDenied = await assertCareTeamMutateAccess(session, id);
    if (accessDenied) return accessDenied;

    const body = addSchema.parse(httpReq.body);
    const before = await countEpisodeCareDoctors(id);
    const instance = await findProgramInstanceAutoApplyState(id);
    try {
      const row = await addEpisodeCareDoctor({
        episodeId: id,
        practitionerId: body.practitionerId,
        assignedByUserId: session.sub,
      });
      const { openHotelPackageOnDoctor } = await import(
        "@/domain/sanatorium/open-program-after-therapist.service"
      );
      const openedPackage = await openHotelPackageOnDoctor(id);
      const shouldRetryAuto =
        before === 0 ||
        openedPackage ||
        instance?.autoApplyState === "PENDING_DOCTOR" ||
        instance?.autoApplyState === "PENDING";
      if (shouldRetryAuto) {
        if (openedPackage) {
          await applyPackageAutoBlocks(id, { trigger: "CARE_TEAM", step: "CHECKIN" }).catch((err) => {
            console.error("[care-team] check-in auto step failed", id, err);
          });
        }
        await applyPackageAutoBlocks(id, { trigger: "CARE_TEAM", step: "DOCTOR" }).catch((err) => {
          console.error("[care-team] package auto-apply failed", id, err);
        });
      }
      const { tryOpenProgramAfterTherapistStage } = await import(
        "@/domain/sanatorium/open-program-after-therapist.service"
      );
      await tryOpenProgramAfterTherapistStage(id).catch(() => null);
      return row;
    } catch (err) {
    if (err instanceof HttpException) throw err;
      const code = (err as Error & { code?: string }).code;
      if (code === EPISODE_CLOSED) {
        throw new HttpException({ error: (err as Error).message, ...{ code: EPISODE_CLOSED } }, 409);
      }
      if (code === "INVALID_PRACTITIONER") {
        throw new HttpException({ error: (err as Error).message, ...{ code } }, 400);
      }
      if (code === "CARE_DOCTOR_EXISTS") {
        throw new HttpException({ error: (err as Error).message, ...{ code } }, 409);
      }
      if (code === "LAST_CARE_DOCTOR") {
        throw new HttpException({ error: (err as Error).message, ...{ code } }, 409);
      }
      if (code === "NOT_FOUND") {
        throw new HttpException({ error: (err as Error).message, ...{ code } }, 404);
      }
      throw err;
    }
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/sanatorium/episodes/:id/care-team")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const accessDenied = await assertCareTeamMutateAccess(session, id);
    if (accessDenied) return accessDenied;

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const practitionerId =
      url.searchParams.get("practitionerId")?.trim() ||
      (httpReq.body.catch(() => ({} as { practitionerId?: string }))).practitionerId;
    if (!practitionerId) {
      throw new HttpException({ error: "practitionerId required" }, 400);
    }

    try {
      await removeEpisodeCareDoctor({
        episodeId: id,
        practitionerId,
        removedByUserId: session.sub,
      });
      return { ok: true };
    } catch (err) {
    if (err instanceof HttpException) throw err;
      const code = (err as Error & { code?: string }).code;
      if (code === EPISODE_CLOSED) {
        throw new HttpException({ error: (err as Error).message, ...{ code: EPISODE_CLOSED } }, 409);
      }
      if (code === "LAST_CARE_DOCTOR") {
        throw new HttpException({ error: (err as Error).message, ...{ code } }, 409);
      }
      if (code === "NOT_FOUND") {
        throw new HttpException({ error: (err as Error).message, ...{ code } }, 404);
      }
      throw err;
    }
  
        });
  }
}
