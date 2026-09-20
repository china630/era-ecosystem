import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { upsertOtaReservation } from '@/lib/channel/ota-ingest.service';
import {
  bindingWebhookPlaintext,
  getChannelManagerBindingByPropertyId,
} from '@/lib/channel/channel-manager-binding.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { logSyncError } from '@/lib/services/channel.service';
import { secretsEqual } from '@/lib/crypto/secret-box';
import {
  ackBookingRevision,
  fetchBookingRevision,
  loadChannexClient,
} from '@/lib/channel/channex-api';
import {
  normalizeChannexRevision,
  parseChannexWebhookNotification,
} from '@/lib/channel/channex-booking';

const bodySchema = z.record(z.unknown());

/**
 * Channex booking webhook is a *notification*.
 * Docs: payload { booking_id, property_id, revision_id } → GET revision → ingest → POST ack.
 */
export async function POST(request: Request) {
  try {
    const raw = bodySchema.parse(await request.json());
    const { propertyId, revisionId } = parseChannexWebhookNotification(raw);
    if (!propertyId) {
      return Response.json({ error: 'property_id required' }, { status: 400 });
    }
    if (!revisionId) {
      return Response.json({ error: 'revision_id required' }, { status: 400 });
    }

    const binding = await getChannelManagerBindingByPropertyId(propertyId);
    if (!binding || binding.provider !== 'channex') {
      return Response.json({ error: 'Unknown property' }, { status: 404 });
    }

    const expected = bindingWebhookPlaintext(binding.webhookSecretCipher);
    const headerSecret =
      request.headers.get('x-channex-webhook-secret')?.trim() ||
      request.headers.get('x-era-ota-secret')?.trim();
    if (!expected || !headerSecret || !secretsEqual(expected, headerSecret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await loadChannexClient();
    if (!client.apiKey) {
      return Response.json({ error: 'Channex partner key missing' }, { status: 503 });
    }

    const pulled = await fetchBookingRevision(client, revisionId);
    if (!pulled.ok) {
      return Response.json(
        { error: `Channex revision fetch failed (${pulled.status})` },
        { status: 502 },
      );
    }
    const data = (pulled.json as { data?: { attributes?: unknown } } | null)?.data;
    const attrs = data?.attributes ?? data;
    const normalized = normalizeChannexRevision(attrs);
    if (!normalized.externalReservationId) {
      return Response.json({ error: 'revision missing unique_id' }, { status: 400 });
    }

    enterRequestTenant(binding.organizationId);

    try {
      const result = await upsertOtaReservation(normalized);
      const ack = await ackBookingRevision(client, revisionId);
      return jsonOk({
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
  } catch (err) {
    return handleRouteError(err);
  }
}
