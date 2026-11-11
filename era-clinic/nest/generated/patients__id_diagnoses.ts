import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patientCardDiagnosisWriteDenied } from "@/lib/patient-card-gates";
import { addEpisodeDiagnosis, deleteEpisodeDiagnosis, listEpisodeDiagnoses, updateEpisodeDiagnosis } from "@/domain/icd/diagnosis-write.service";
import { resolveEpisodeForPatient } from "@/domain/sanatorium/episode-resolve";
import { EPISODE_CLOSED, episodeWriteDenied } from "@/domain/sanatorium/episode-gates";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/patients/:id/diagnoses", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return denied;

        const { id } = httpReq.params;
    const episodeParam = new URL(req.url).searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    if (!episode) return sendJson(httpRes, { items: [], episodeId: null, status: null });
    return sendJson(httpRes, {
      items: await listEpisodeDiagnoses(episode.id),
      episodeId: episode.id,
      status: episode.status,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/patients/:id/diagnoses", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = httpReq.params;
    const body = createSchema.parse(httpReq.body);
    const episodeParam =
      body.episodeId ?? new URL(req.url).searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    const writeDenied = patientCardDiagnosisWriteDenied(
      Boolean(episode && episode.status === "OPEN"),
    );
    if (writeDenied || !episode) {
      return sendJson(httpRes, { error: writeDenied ?? "No open sanatorium episode", ...{
        code: "NO_OPEN_EPISODE",
      } }, 409);
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) return sendJson(httpRes, { error: closed, ...{ code: EPISODE_CLOSED } }, 409);
    const {
      CARE_TEAM_REQUIRED,
      episodeCareTeamDenied,
    } = await import("@/domain/sanatorium/episode-care-team-gates");
    const { countEpisodeCareDoctors } = await import(
      "@/domain/sanatorium/episode-care-team.service"
    );
    const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episode.id));
    if (careDenied) {
      return sendJson(httpRes, { error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
    }
    const row = await addEpisodeDiagnosis(episode.id, {
      icdCodeId: body.icdCodeId,
      note: body.note,
      recordedByUserId: session!.sub,
      recordedByPractitionerId: await (
        await import("@/lib/auth/session-practitioner")
      ).resolveSessionPractitionerId(session!.sub),
    });
    const { tryOpenProgramAfterTherapistStage } = await import(
      "@/domain/sanatorium/open-program-after-therapist.service"
    );
    let day1Program = null;
    try {
      day1Program = await tryOpenProgramAfterTherapistStage(episode.id);
    } catch (err) {
      console.error("[day1] open program after diagnosis failed", episode.id, err);
    }
    return sendJson(httpRes, { ...row, day1Program }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/patients/:id/diagnoses", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id: patientRefId } = httpReq.params;
    const diagnosisId = new URL(req.url).searchParams.get("id");
    if (!diagnosisId) return sendJson(httpRes, { error: "id required" }, 400);
    await deleteEpisodeDiagnosis(diagnosisId, patientRefId);
    return sendJson(httpRes, { deleted: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/patients/:id/diagnoses", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id: patientRefId } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateEpisodeDiagnosis(body.id, patientRefId, {
      icdCodeId: body.icdCodeId,
      note: body.note,
    });
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
