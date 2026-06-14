import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import { upsertOtaReservation } from '@/lib/channel/ota-ingest.service';
import { logSyncError } from '@/lib/services/channel.service';

export async function pullOtaReservations(since?: Date) {
  const adapter = resolveChannelAdapter();
  if (!adapter.pullReservations) {
    return {
      ok: true,
      adapter: adapter.code,
      pulled: 0,
      message: 'Adapter does not support pull',
    };
  }

  const sinceDate = since ?? new Date(Date.now() - 24 * 3600 * 1000);
  const items = await adapter.pullReservations(sinceDate);
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  const errors: string[] = [];

  for (const payload of items) {
    try {
      const result = await upsertOtaReservation(payload);
      if (result.action === 'created') created += 1;
      else if (result.action === 'updated') updated += 1;
      else if (result.action === 'cancelled') cancelled += 1;
      if (adapter.ackReservation && payload.externalReservationId) {
        await adapter.ackReservation(payload.externalReservationId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'pull item failed';
      errors.push(`${payload.externalReservationId}: ${msg}`);
      await logSyncError({
        otaReference: payload.externalReservationId,
        errorMessage: msg,
      });
    }
  }

  return {
    ok: errors.length === 0,
    adapter: adapter.code,
    pulled: items.length,
    created,
    updated,
    cancelled,
    errors,
  };
}
