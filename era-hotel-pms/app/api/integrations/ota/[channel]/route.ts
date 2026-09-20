import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  normalizeOtaWebhookBody,
  upsertOtaReservation,
} from '@/lib/channel/ota-ingest.service';
import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import { logSyncError } from '@/lib/services/channel.service';

const bodySchema = z.object({
  event: z.string().min(1),
  externalReservationId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

/** OTA webhook ingest — normalized payload → idempotent reservation upsert. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  try {
    const { channel } = await params;
    const secret = process.env.ERA_OTA_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return Response.json({ error: 'OTA webhook secret not configured' }, { status: 503 });
    }
    const header = request.headers.get('x-era-ota-secret')?.trim();
    if (!header || header !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = bodySchema.parse(await request.json());
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

    return jsonOk({
      accepted: true,
      channel,
      adapter: adapter.code,
      mode: adapter.code,
      ...serialize(result),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
