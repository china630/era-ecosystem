import { z } from "zod";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { ackElektrawebOutbox } from "@/lib/integration/elektraweb-bridge/outbox.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  ok: z.boolean(),
  elektrawebLineId: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/elektraweb-bridge/outbox/:id/ack", async (httpReq, httpRes) => {
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

  
    const auth = await authenticateBridgeRequest(request);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const row = await ackElektrawebOutbox({
      organizationId: auth.organizationId,
      id,
      ok: body.ok,
      elektrawebLineId: body.elektrawebLineId,
      error: body.error,
    });
    return sendJson(httpRes, { id: row.id, status: row.status, organizationId: auth.organizationId });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
