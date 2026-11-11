import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { fifoConfirmBlockedReason, procedureConfirmHttpStatus } from "@/lib/sanatorium-fifo-gates";
import { countEpisodesAssignedToPractitioner, findProposedProcedureOrdersByIds, listProposedProcedureOrdersForPatient } from "@/domain/procedure/procedure-order.service";
import { placeOrPinOrders } from "@/domain/procedure/place-or-pin-orders";
import { resolveClinicDataScope, episodeAssignedToPractitionerWhere } from "@/lib/auth/clinic-data-scope";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1),
});

/** Doctor confirms PROPOSED orders → FIFO place on resources. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/procedures/confirm", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return denied;

    const body = bodySchema.parse(httpReq.body);

    const selected = await findProposedProcedureOrdersByIds(body.orderIds);
    if (selected.length === 0) {
      return sendJson(httpRes, { error: "No PROPOSED orders to confirm" }, 404);
    }

    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode === "ASSIGNED") {
      if (!scope.practitionerId) {
        return sendJson(httpRes, { error: "Forbidden" }, 403);
      }
      const episodeIds = [
        ...new Set(
          selected
            .map((o) => o.clinicalEpisodeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (episodeIds.length === 0) {
        return sendJson(httpRes, { error: "Orders are not linked to a care course" }, 409);
      }
      const allowed = await countEpisodesAssignedToPractitioner(
        episodeIds,
        episodeAssignedToPractitionerWhere(scope.practitionerId),
      );
      if (allowed !== episodeIds.length) {
        return sendJson(httpRes, { error: "Not on care team for this course", ...{
          code: "CARE_TEAM_REQUIRED",
        } }, 403);
      }
    }

    const patientRefId = selected[0].patientRefId;
    const proposedForPatient = await listProposedProcedureOrdersForPatient(patientRefId);
    const fifoBlock = fifoConfirmBlockedReason({
      confirmingIds: body.orderIds,
      proposedForPatient,
    });
    if (fifoBlock) {
      return sendJson(httpRes, { error: fifoBlock }, procedureConfirmHttpStatus(fifoBlock));
    }

    const placement = await placeOrPinOrders(body.orderIds, {
      confirmedByUserId: session.sub,
    });
    const misses = placement.failures.map((row) => ({
      ymd: row.ymd ?? "",
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      reason: row.reason,
    }));
    if (placement.placed < 1) {
      const onlyCabinSex =
        misses.length > 0 && misses.every((row) => row.reason === "cabin_sex");
      const onlyMissingCabin =
        placement.missingCabinNames.length > 0 &&
        (misses.length === 0 || misses.every((row) => row.reason === "no_cabin"));
      if (onlyCabinSex) {
        return sendJson(httpRes, { error: 
          [...new Set(misses.map((row) => row.procedureName))].join(", "), ...{ code: "CABIN_SEX", misses } }, 409);
      }
      if (onlyMissingCabin) {
        return sendJson(httpRes, { error: placement.missingCabinNames.join(", "), ...{
          code: "NO_CABIN",
          misses,
        } }, 409);
      }
      return sendJson(httpRes, { error: 
        misses.map((row) => row.procedureName || row.procedureCode).join(", ") ||
          placement.missingCabinNames.join(", ") ||
          "Could not place sessions", ...{ code: "PLACE_FAILED", misses } }, 409);
    }
    return sendJson(httpRes, {
      placed: placement.placed,
      orderIds: placement.placedIds,
      ...(misses.length > 0 ? { misses } : {}),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
