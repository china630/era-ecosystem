import { getChannelAvailability } from '@/lib/services/channel.service';
import { logSyncError } from '@/lib/services/channel.service';
import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import type { AvailabilityPushRow } from '@/lib/channel/adapters/types';
import { prisma } from '@/lib/prisma';

export async function pushChannelAvailability(from: Date, to: Date) {
  const matrix = await getChannelAvailability(from, to);
  const channels = await prisma.channel.findMany({
    where: { active: true },
    include: { roomMappings: true },
  });

  const rows: AvailabilityPushRow[] = [];

  for (const ch of channels) {
    for (const rt of matrix) {
      const mapping = ch.roomMappings.find((m) => m.roomTypeId === rt.roomTypeId);
      const otaRoomCode = mapping?.otaRoomCode ?? rt.roomTypeCode;
      for (const day of rt.days) {
        const bar = await prisma.roomTypeRate.findFirst({
          where: {
            roomTypeId: rt.roomTypeId,
            date: new Date(day.date),
            ratePlan: { type: 'BASE', code: 'BAR' },
          },
          select: { amount: true },
        });
        rows.push({
          date: day.date,
          otaRoomCode,
          available: day.available,
          stopSell: day.stopSell,
          price: bar ? Number(bar.amount) : undefined,
        });
      }
    }
  }

  const adapter = resolveChannelAdapter();
  const result = await adapter.pushAvailability(rows);

  if (!result.ok) {
    await logSyncError({
      errorMessage: result.errors?.join('; ') ?? `${adapter.code} push failed`,
    });
  }

  return { adapter: adapter.code, ...result, rowCount: rows.length };
}
