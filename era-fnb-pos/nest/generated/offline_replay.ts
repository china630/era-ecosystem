import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const itemSchema = z.object({
  id: z.string(),
  kind: z.enum(["pay", "fire"]),
  ticketId: z.string(),
  payload: z.record(z.unknown()),
});

const bodySchema = z.object({
  actions: z.array(itemSchema).min(1).max(50),
});

/** Replay queued pay/fire from offline client. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/offline/replay", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_OFFLINE_REPLAY);
    if (denied) return denied;

    const { actions } = bodySchema.parse(httpReq.body);
    const origin = new URL(request.url).origin;
    const results: { id: string; ok: boolean; status: number }[] = [];

    for (const action of actions) {
      const path =
        action.kind === "pay"
          ? `/api/tickets/${action.ticketId}/pay`
          : `/api/tickets/${action.ticketId}/fire`;
      const res = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify(action.payload),
      });
      results.push({ id: action.id, ok: res.ok, status: res.status });
    }

    return sendJson(httpRes, { replayed: results.length, results });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
