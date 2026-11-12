import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { activeBodyPartCodes } from "@/domain/catalog/body-part-lookup";
import { listPatientContraindications, findPatientContraindicationForDelete, deletePatientContraindication, findClinicalEpisodeForPatient, createPatientContraindication } from "@/domain/patient/patient.service";
import { EPISODE_CLOSED, episodeWriteDenied, NO_OPEN_EPISODE } from "@/domain/sanatorium/episode-gates";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  bodyPart: z.string().min(1),
  note: z.string().optional(),
  episodeId: z.string().min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/patients/:id/contraindications", async (httpReq, httpRes) => {
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
    const url = new URL(req.url);
    const episodeId = url.searchParams.get("episode");
    const rows = await listPatientContraindications(id, episodeId);
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/patients/:id/contraindications", async (httpReq, httpRes) => {
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
    const url = new URL(req.url);
    const rowId = url.searchParams.get("id");
    if (!rowId) return sendJson(httpRes, { error: "id required" }, 400);
    const existing = await findPatientContraindicationForDelete(patientRefId, rowId);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    if (existing.episodeId) {
      const closed = episodeWriteDenied(existing.episode?.status);
      if (closed) return sendJson(httpRes, { error: closed, ...{ code: EPISODE_CLOSED } }, 409);
    }
    await deletePatientContraindication(patientRefId, rowId);
    return sendJson(httpRes, { ok: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/patients/:id/contraindications", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse(httpReq.body);
    const allowedParts = await activeBodyPartCodes();
    if (!allowedParts.has(body.bodyPart.trim().toUpperCase())) {
      return sendJson(httpRes, { error: "Unknown body part" }, 400);
    }
    const episode = await findClinicalEpisodeForPatient(body.episodeId, id);
    if (!episode) {
      return sendJson(httpRes, { error: "Episode not found for patient", ...{ code: NO_OPEN_EPISODE } }, 404);
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) {
      return sendJson(httpRes, { error: closed, ...{ code: EPISODE_CLOSED } }, 409);
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
      return sendJson(httpRes, { error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
    }
    const row = await createPatientContraindication({
      patientRefId: id,
      episodeId: episode.id,
      bodyPart: body.bodyPart,
      note: body.note,
    });
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
