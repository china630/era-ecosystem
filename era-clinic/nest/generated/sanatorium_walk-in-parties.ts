import { z } from "zod";
import { jsonError, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { todayBakuYmd } from "@/lib/baku-day";
import { WalkInPartyError, createWalkInParty, listWalkInParties } from "@/domain/sanatorium/walk-in-party.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function fail(err: unknown) {
  if (err instanceof WalkInPartyError) return jsonError(err.message, err.status, { code: err.code });
  return handleRouteError(err);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/walk-in-parties", async (httpReq, httpRes) => {
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
    return sendJson(httpRes, await listWalkInParties());
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
  http.post("/api/sanatorium/walk-in-parties", async (httpReq, httpRes) => {
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
    const body = createSchema.parse(httpReq.body);
    const party = await createWalkInParty(
      { name: body.name, visitDate: body.visitDate ?? todayBakuYmd() },
      { userId: guard.session.sub, actorName: guard.session.fullName, request: req },
    );
    return sendJson(httpRes, party);
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
