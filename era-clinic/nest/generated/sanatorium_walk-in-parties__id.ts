import { z } from "zod";
import { jsonError, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { WalkInPartyError, addWalkInPartyGuest, addWalkInPartyLine, getWalkInParty, listWalkInPartyJournal, removeWalkInPartyGuest, removeWalkInPartyLine, sendWalkInPartyToCashier, updateWalkInPartyGuest } from "@/domain/sanatorium/walk-in-party.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const sex = z.enum(["MALE", "FEMALE"]);

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("addGuest"),
    sex,
    nationality: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    patientRefId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("updateGuest"),
    guestId: z.string().min(1),
    sex,
    nationality: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
  z.object({
    action: z.literal("removeGuest"),
    guestId: z.string().min(1),
  }),
  z.object({
    action: z.literal("addLine"),
    guestId: z.string().min(1),
    kind: z.enum(["procedure", "lab", "visit"]),
    code: z.string().min(1),
    qty: z.number().int().min(1).max(20).optional(),
    practitionerId: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    physioFields: z.record(z.unknown()).nullable().optional(),
    siteIds: z.array(z.string()).optional(),
    siteApplyMode: z.enum(["TURN", "TOGETHER"]).nullable().optional(),
    siteLaterality: z
      .record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable())
      .optional(),
  }),
  z.object({
    action: z.literal("removeLine"),
    guestId: z.string().min(1),
    lineId: z.string().min(1),
    kind: z.enum(["procedure", "lab", "visit"]),
  }),
  z.object({ action: z.literal("send") }),
]);

function fail(err: unknown) {
  if (err instanceof WalkInPartyError) return jsonError(err.message, err.status, { code: err.code });
  return handleRouteError(err);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/walk-in-parties/:id", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const guard = await assertOpsApiPermission(req);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    const journal = new URL(req.url).searchParams.get("journal") === "1";
    return sendJson(httpRes, journal ? await listWalkInPartyJournal(id) : await getWalkInParty(id));
  } catch (err) {
    return fail(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/sanatorium/walk-in-parties/:id", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const guard = await assertOpsApiPermission(req);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const actor = { userId: guard.session.sub, actorName: guard.session.fullName, request: req };
    if (body.action === "addGuest") return sendJson(httpRes, await addWalkInPartyGuest(id, body, actor));
    if (body.action === "updateGuest") {
      return sendJson(httpRes, await updateWalkInPartyGuest(id, body.guestId, body, actor));
    }
    if (body.action === "removeGuest") {
      return sendJson(httpRes, await removeWalkInPartyGuest(id, body.guestId, actor));
    }
    if (body.action === "addLine") return sendJson(httpRes, await addWalkInPartyLine(id, body.guestId, body, actor));
    if (body.action === "removeLine") {
      return sendJson(httpRes, await removeWalkInPartyLine(id, body.guestId, body.lineId, body.kind, actor));
    }
    return sendJson(httpRes, await sendWalkInPartyToCashier(id, actor));
  } catch (err) {
    return fail(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
