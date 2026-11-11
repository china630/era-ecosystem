import { NextResponse } from "next/server";
import { z } from "zod";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const payloadSchema = z.object({
  event: z.enum(["checked_out", "cancelled"]),
  reservationId: z.string(),
  roomNumber: z.string().optional(),
});

/** PMS → fb-pos: close open tickets linked to departed guest (doc/openapi). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/webhooks/pms/reservation-lifecycle", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  const secret = request.headers.get("x-fb-pos-webhook-secret");
  if (
    process.env.FB_POS_WEBHOOK_SECRET &&
    secret !== process.env.FB_POS_WEBHOOK_SECRET
  ) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }

  const body = payloadSchema.parse(httpReq.body);
  return sendJson(httpRes, { received: true, ...body });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
