import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { upsertOtaReservation } from '@/lib/channel/ota-ingest.service';
import { bindingWebhookPlaintext, getChannelManagerBindingByPropertyId, isBindingPoolUnavailable } from '@/lib/channel/channel-manager-binding.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { logSyncError } from '@/lib/services/channel.service';
import { secretsEqual } from '@/lib/crypto/secret-box';
import { ackBookingRevision, fetchBookingRevision, loadChannexClient } from '@/lib/channel/channex-api';
import { normalizeChannexRevision, parseChannexWebhookNotification } from '@/lib/channel/channex-booking';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.record(z.unknown());

/**
 * Channex booking webhook is a *notification*.
 * Docs: payload { booking_id, property_id, revision_id } → GET revision → ingest → POST ack.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/channex/webhook", async (httpReq, httpRes) => {
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

  
    const raw = bodySchema.parse(httpReq.body);
    const { propertyId, revisionId } = parseChannexWebhookNotification(raw);
    if (!propertyId) {
      return sendJson(httpRes, { error: 'property_id required' }, 400);
    }
    if (!revisionId) {
      return sendJson(httpRes, { error: 'revision_id required' }, 400);
    }

    let binding: Awaited<ReturnType<typeof getChannelManagerBindingByPropertyId>>;
    try {
      binding = await getChannelManagerBindingByPropertyId(propertyId);
    } catch (err) {
      if (isBindingPoolUnavailable(err)) {
        return sendJson(httpRes, { error: 'Organization registry unavailable' }, 503);
      }
      throw err;
    }
    if (!binding || binding.provider !== 'channex') {
      return sendJson(httpRes, { error: 'Unknown property' }, 404);
    }

    const expected = bindingWebhookPlaintext(binding.webhookSecretCipher);
    const headerSecret =
      request.headers.get('x-channex-webhook-secret')?.trim() ||
      request.headers.get('x-era-ota-secret')?.trim();
    if (!expected || !headerSecret || !secretsEqual(expected, headerSecret)) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }

    const client = await loadChannexClient();
    if (!client.apiKey) {
      return sendJson(httpRes, { error: 'Channex partner key missing' }, 503);
    }

    const pulled = await fetchBookingRevision(client, revisionId);
    if (!pulled.ok) {
      return sendJson(httpRes, 
        { error: `Channex revision fetch failed (${pulled.status})` }, 502);
    }
    const data = (pulled.json as { data?: { attributes?: unknown } } | null)?.data;
    const attrs = data?.attributes ?? data;
    const normalized = normalizeChannexRevision(attrs);
    if (!normalized.externalReservationId) {
      return sendJson(httpRes, { error: 'revision missing unique_id' }, 400);
    }

    enterRequestTenant(binding.organizationId);

    try {
      const result = await upsertOtaReservation(normalized);
      const ack = await ackBookingRevision(client, revisionId);
      return sendJson(httpRes, {
        accepted: true,
        channel: 'channex',
        organizationId: binding.organizationId,
        acked: ack.ok,
        ...serialize(result),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Channex ingest failed';
      await logSyncError({
        otaReference: normalized.externalReservationId,
        errorMessage: message,
      });
      throw err;
    }
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
