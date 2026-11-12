import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { normalizeOtaWebhookBody, upsertOtaReservation } from '@/lib/channel/ota-ingest.service';
import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import { logSyncError } from '@/lib/services/channel.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  event: z.string().min(1),
  externalReservationId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

/** OTA webhook ingest — normalized payload → idempotent reservation upsert. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/ota/:channel", async (httpReq, httpRes) => {
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

  
    const { channel } = httpReq.params;
    const secret = process.env.ERA_OTA_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return sendJson(httpRes, { error: 'OTA webhook secret not configured' }, 503);
    }
    const header = request.headers.get('x-era-ota-secret')?.trim();
    if (!header || header !== secret) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }

    const raw = bodySchema.parse(httpReq.body);
    const normalized = normalizeOtaWebhookBody(channel, raw as Record<string, unknown>);

    if (!normalized.externalReservationId) {
      throw new Error('externalReservationId is required');
    }

    const adapter = await resolveChannelAdapter();
    let result;
    try {
      result = await upsertOtaReservation(normalized);
      if (adapter.ackReservation) {
        await adapter.ackReservation(normalized.externalReservationId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OTA ingest failed';
      await logSyncError({
        otaReference: normalized.externalReservationId,
        errorMessage: message,
      });
      throw err;
    }

    return sendJson(httpRes, {
      accepted: true,
      channel,
      adapter: adapter.code,
      mode: adapter.code,
      ...serialize(result),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
