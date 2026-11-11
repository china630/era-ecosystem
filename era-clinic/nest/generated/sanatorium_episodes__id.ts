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
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/episodes/:id", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
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
    return sendJson(httpRes, episode ? { ...episode, hotelStay } : episode);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/sanatorium/episodes/:id", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const permDenied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (permDenied) return permDenied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = patchSchema.parse(httpReq.body);
    const episode = await findEpisodeAnamnesisPatchBase(id);
    if (!episode) return sendJson(httpRes, { error: "Episode not found" }, 404);
    const { EPISODE_CLOSED, episodeWriteDenied } = await import(
      "@/domain/sanatorium/episode-gates"
    );
    const closed = episodeWriteDenied(episode.status);
    if (closed) return sendJson(httpRes, { error: closed, ...{ code: EPISODE_CLOSED } }, 409);

    if (body.anamnesisText !== undefined) {
      const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(id));
      if (careDenied) {
        return sendJson(httpRes, { error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
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
        day1Program = {
          opened: false,
          reason: "INSTANTIATE_FAILED",
        };
        console.error("[day1] open program after anamnesis failed", id, err);
      }
    }

    return sendJson(httpRes, { ...updated, day1Program });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/sanatorium/episodes/:id", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const { id } = httpReq.params;
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const permDenied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (permDenied) return permDenied;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const rawBody = await req.text();
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
        return sendJson(httpRes, { error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
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
        console.error("[day1] open program after complaint failed", id, err);
      }
      return sendJson(httpRes, { ...row, day1Program });
    }
    if (action === "diagnosis") {
      const parsed = diagnosisSchema.parse(body);
      return sendJson(httpRes, 
        await addDiagnosis(id, {
          ...parsed,
          recordedByUserId: session.sub,
          recordedByPractitionerId: await (
            await import("@/lib/auth/session-practitioner")
          ).resolveSessionPractitionerId(session.sub),
        }),
      );
    }
    if (action === "lab") {
      const parsed = labSchema.parse(body);
      return sendJson(httpRes, 
        await createEpisodeLabOrder(id, parsed.testCode, {
          confirmRepeat: parsed.confirmRepeat,
        }),
      );
    }
    if (action === "instantiate-program") {
      const parsed = instantiateProgramSchema.parse(body);
      const existing = await findProgramInstanceForEpisode(id);
      if (existing) return sendJson(httpRes, { error: "Program already assigned" }, 409);
      const episode = await findEpisodeReservationForProgram(id);
      if (!episode) return sendJson(httpRes, { error: "Episode not found" }, 404);
      const { procedureLaneDenial } = await import("@/domain/sanatorium/lane-gates");
      const denied = await procedureLaneDenial(id);
      if (denied) return sendJson(httpRes, { error: denied.message, ...{ code: denied.code } }, 409);
      const instance = await instantiateProgramFromTemplate({
        episodeId: id,
        programCode: parsed.programCode,
        reservationId: episode.reservationId ?? undefined,
        startsOn: new Date(parsed.startsOn),
      });
      return sendJson(httpRes, instance);
    }
    if (action === "complete-checkup") {
      const parsed = completeCheckupSchema.parse(body);
      return sendJson(httpRes, 
        await completeCheckupAndSchedule({
          episodeId: id,
          programCode: parsed.programCode,
          startsOn: parsed.startsOn ? new Date(parsed.startsOn) : undefined,
        }),
      );
    }
    if (action === "close") {
      return sendJson(httpRes, await closeWalkInEpisode(id));
    }

    return sendJson(httpRes, { error: "Unknown action" }, 400);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
