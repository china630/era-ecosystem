import { getChannelAvailability } from '@/lib/services/channel.service';
import { logSyncError } from '@/lib/services/channel.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';
import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import type { AvailabilityPushRow } from '@/lib/channel/adapters/types';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

async function recordChannelSyncEvent(
  eventType: 'channel.push' | 'channel.pull',
  payload: Record<string, unknown>,
  ok: boolean,
  lastError?: string,
) {
  try {
    await prisma.outboundEventLog.create({
      data: {
        eventType,
        payloadJson: JSON.stringify(payload),
        status: ok ? 'SENT' : 'FAILED',
        attempts: 1,
        lastError: lastError ?? null,
      },
    });
  } catch (err) {
    console.error('OutboundEventLog channel sync write failed', err);
  }
}

/**
 * Build ARI push rows: room mapping + rate mappings + stop-sell flag (not room-only).
 */
export async function pushChannelAvailability(from: Date, to: Date) {
  const matrix = await getChannelAvailability(from, to);
  const channels = await prisma.channel.findMany({
    where: { active: true },
    include: {
      roomMappings: true,
      rateMappings: { include: { ratePlan: true } },
    },
  });

  const rows: AvailabilityPushRow[] = [];

  for (const ch of channels) {
    for (const rt of matrix) {
      const roomMapping = ch.roomMappings.find((m) => m.roomTypeId === rt.roomTypeId);
      const otaRoomCode = roomMapping?.otaRoomCode ?? rt.roomTypeCode;

      const rateTargets =
        ch.rateMappings.length > 0
          ? ch.rateMappings.map((m) => ({
              ratePlanId: m.ratePlanId,
              ratePlanCode: m.ratePlan.code,
              otaRateCode: m.otaRateCode,
            }))
          : [
              {
                ratePlanId: null as string | null,
                ratePlanCode: 'BAR',
                otaRateCode: undefined as string | undefined,
              },
            ];

      for (const day of rt.days) {
        for (const rate of rateTargets) {
          const amountRow = rate.ratePlanId
            ? await prisma.roomTypeRate.findFirst({
                where: {
                  roomTypeId: rt.roomTypeId,
                  date: new Date(day.date),
                  ratePlanId: rate.ratePlanId,
                },
                select: { amount: true },
              })
            : await prisma.roomTypeRate.findFirst({
                where: {
                  roomTypeId: rt.roomTypeId,
                  date: new Date(day.date),
                  ratePlan: { type: 'BASE', code: 'BAR' },
                },
                select: { amount: true },
              });

          rows.push({
            date: day.date,
            channelCode: ch.code,
            otaRoomCode,
            otaRateCode: rate.otaRateCode,
            ratePlanCode: rate.ratePlanCode,
            available: day.available,
            stopSell: day.stopSell,
            price: amountRow ? decimalToNumber(amountRow.amount) : undefined,
          });
        }
      }
    }
  }

  const adapter = resolveChannelAdapter();
  const result = await adapter.pushAvailability(rows);

  await recordChannelSyncEvent(
    'channel.push',
    { adapter: adapter.code, rowCount: rows.length, from, to },
    result.ok,
    result.ok ? undefined : (result.errors?.join('; ') ?? result.message),
  );

  if (!result.ok) {
    await logSyncError({
      errorMessage: result.errors?.join('; ') ?? `${adapter.code} push failed`,
    });
  }

  return { adapter: adapter.code, ...result, rowCount: rows.length };
}

/** Lightweight fire-and-forget ARI push when policy.channelAutoPushEnabled. */
export async function maybeAutoPushAfterStopSell() {
  const policy = await getHotelPolicy();
  if (!policy.channelAutoPushEnabled) return { skipped: true as const };

  const from = new Date();
  const to = new Date(Date.now() + 14 * 86400000);
  void pushChannelAvailability(from, to).catch((err) => {
    console.error('channel auto-push after stop-sell failed', err);
  });
  return { skipped: false as const, triggered: true as const };
}
