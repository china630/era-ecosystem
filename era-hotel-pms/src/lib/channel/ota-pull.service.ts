import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import { upsertOtaReservation } from '@/lib/channel/ota-ingest.service';
import { logSyncError } from '@/lib/services/channel.service';
import { prisma } from '@/lib/prisma';

async function recordPullEvent(
  adapter: string,
  payload: Record<string, unknown>,
  ok: boolean,
  lastError?: string,
) {
  try {
    await prisma.outboundEventLog.create({
      data: {
        eventType: 'channel.pull',
        payloadJson: JSON.stringify({ adapter, ...payload }),
        status: ok ? 'SENT' : 'FAILED',
        attempts: 1,
        lastError: lastError ?? null,
      },
    });
  } catch (err) {
    console.error('OutboundEventLog channel pull write failed', err);
  }
}

export async function pullOtaReservations(since?: Date) {
  const adapter = resolveChannelAdapter();
  if (!adapter.pullReservations) {
    const result = {
      ok: true,
      adapter: adapter.code,
      pulled: 0,
      message: 'Adapter does not support pull',
    };
    await recordPullEvent(adapter.code, result, true);
    return result;
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

  const result = {
    ok: errors.length === 0,
    adapter: adapter.code,
    pulled: items.length,
    created,
    updated,
    cancelled,
    errors,
  };

  await recordPullEvent(
    adapter.code,
    { pulled: result.pulled, created, updated, cancelled },
    result.ok,
    result.ok ? undefined : errors.join('; '),
  );

  return result;
}
