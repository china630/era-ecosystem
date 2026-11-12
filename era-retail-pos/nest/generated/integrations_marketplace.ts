import { z } from "zod";
import { createMarketplaceWebhookEvent } from "@/lib/marketplace-integration.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  channel: z.enum(["umico", "kaspi", "other"]).default("other"),
  externalRef: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/marketplace", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const secret = req.headers.get("x-marketplace-secret");
    const expected = process.env.MARKETPLACE_WEBHOOK_SECRET ?? "marketplace-dev";
    if (secret !== expected) {
      return sendRouteError(httpRes, new Error("Unauthorized"));
    }
    const row = await createMarketplaceWebhookEvent({
      channel: body.channel,
      externalRef: body.externalRef,
      payloadJson: JSON.stringify(body.payload ?? {}),
    });
    return sendJson(httpRes, { eventId: row.id, channel: body.channel }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
