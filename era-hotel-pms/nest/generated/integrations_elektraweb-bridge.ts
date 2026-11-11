import { z } from 'zod';
import { authenticateBridgeRequest } from '@/lib/integration/elektraweb-bridge/auth';
import { bridgeEnvelopeSchema, ingestElektrawebBridgeEnvelope } from '@/lib/integration/elektraweb-bridge/ingest';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const batchSchema = z.object({
  items: z.array(bridgeEnvelopeSchema).min(1).max(20),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/elektraweb-bridge", async (httpReq, httpRes) => {
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

  try {
    const auth = await authenticateBridgeRequest(request);
    const json = httpReq.body;

    if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
      const { items } = batchSchema.parse(json);
      // Guests → reservations → folio within each item's entity, but across batch sort by entity
      const order = { guest: 0, reservation: 1, folio: 2, unknown: 3 } as const;
      const sorted = [...items].sort((a, b) => {
        const ea = a.entityHint ?? 'unknown';
        const eb = b.entityHint ?? 'unknown';
        return order[ea] - order[eb];
      });
      const results = [];
      for (const item of sorted) {
        results.push(await ingestElektrawebBridgeEnvelope(auth, item));
      }
      return sendJson(httpRes, {
        organizationId: auth.organizationId,
        elektrawebHotelId: auth.elektrawebHotelId,
        results,
      });
    }

    const envelope = bridgeEnvelopeSchema.parse(json);
    const summary = await ingestElektrawebBridgeEnvelope(auth, envelope);
    return sendJson(httpRes, summary);
  } catch (err) {
    if (err instanceof Error && err.message.includes('HOTELID mismatch')) {
      return sendJson(httpRes, { error: err.message }, 409);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
