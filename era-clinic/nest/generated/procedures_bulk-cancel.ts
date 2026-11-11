import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { cancelProcedureOrder } from "@/domain/procedure/procedure-attendance.service";
import { cancelProposedProcedureOrder, createReplacementProcedureOrder, findProcedureTypeFullByCode, getClinicalEpisodeById, listBulkCancelProcedureTargets } from "@/domain/procedure/procedure-order.service";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import { placeOrPinOrders } from "@/domain/procedure/place-or-pin-orders";
import { stampEpisodeOnCreate } from "@/domain/sanatorium/episode-stamp";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  episodeId: z.string().optional(),
  patientRefId: z.string().optional(),
  procedureCode: z.string().optional(),
  from: z.string().optional(),
  reason: z.string().min(1),
  replaceWithCode: z.string().optional(),
});

/**
 * Mass-cancel future SCHEDULED/PROPOSED orders for an episode or patient.
 * Optional replaceWithCode creates PROPOSED substitutes and places them.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/procedures/bulk-cancel", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return denied;

    const body = bodySchema.parse(httpReq.body);
    if (!body.episodeId && !body.patientRefId) {
      return sendJson(httpRes, { error: "episodeId or patientRefId required" }, 400);
    }

    let patientRefId = body.patientRefId;
    let reservationId: string | null | undefined;
    if (body.episodeId) {
      const episode = await getClinicalEpisodeById(body.episodeId);
      if (!episode) return sendJson(httpRes, { error: "Episode not found" }, 404);
      patientRefId = episode.patientRefId ?? patientRefId;
      reservationId = episode.reservationId;
    }
    if (!patientRefId) return sendJson(httpRes, { error: "patientRefId required" }, 400);

    const from = body.from ? new Date(body.from) : new Date();
    const where = {
      patientRefId,
      status: { in: ["SCHEDULED", "PROPOSED"] as ("SCHEDULED" | "PROPOSED")[] },
      scheduledAt: { gte: from },
      ...(body.procedureCode ? { procedureCode: body.procedureCode } : {}),
      ...(reservationId ? { reservationId } : {}),
    };

    const targets = await listBulkCancelProcedureTargets(where);

    let cancelled = 0;
    for (const t of targets) {
      if (t.status === "PROPOSED") {
        await cancelProposedProcedureOrder(t.id, {
          cancelledByUserId: session.sub,
          reason: body.reason,
        });
        await releaseProcedureOccupancy([t.id]);
        cancelled++;
      } else {
        await cancelProcedureOrder(
          t.id,
          { userId: session.sub, canOverrideCheckIn: true },
          body.reason,
        );
        cancelled++;
      }
    }

    let replaced = 0;
    let placed = 0;
    if (body.replaceWithCode && targets.length > 0) {
      const pt = await findProcedureTypeFullByCode(body.replaceWithCode);
      if (!pt) return sendJson(httpRes, { error: `Unknown replaceWithCode ${body.replaceWithCode}` }, 400);

      if (body.episodeId) {
        const { procedureLaneDenial } = await import("@/domain/sanatorium/lane-gates");
        const denied = await procedureLaneDenial(body.episodeId);
        if (denied) return sendJson(httpRes, { error: denied.message, ...{ code: denied.code } }, 409);
      }

      const newIds: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        const src = targets[i];
        const clinicalEpisodeId =
          body.episodeId ??
          (await stampEpisodeOnCreate({
            patientRefId,
            reservationId,
          }));
        const created = await createReplacementProcedureOrder({
          patientRefId,
          clinicalEpisodeId: clinicalEpisodeId ?? undefined,
          procedureType: pt,
          scheduledAt: new Date(from.getTime() + i * 60_000),
          endsAt: new Date(from.getTime() + (i + 1) * 60_000),
          sequenceIndex: src.sequenceIndex ?? i,
          bodyPart: src.bodyPart ?? undefined,
          reservationId: reservationId ?? undefined,
        });
        newIds.push(created.id);
        replaced++;
      }
      placed = (
        await placeOrPinOrders(newIds, {
          confirmedByUserId: session.sub,
        })
      ).placed;
    }

    return sendJson(httpRes, { cancelled, replaced, placed });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
