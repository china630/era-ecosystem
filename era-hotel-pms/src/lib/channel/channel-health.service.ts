import {
  getChannelAdapterReadiness,
  resolveChannelAdapter,
} from '@/lib/channel/adapters/registry';
import { countPendingAriJobs } from '@/lib/channel/channel-ari-queue.service';
import { getChannelManagerBinding } from '@/lib/channel/channel-manager-binding.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';
import { prisma } from '@/lib/prisma';

export async function getChannelHealth() {
  const adapter = await resolveChannelAdapter();
  const readiness = await getChannelAdapterReadiness();
  const policy = await getHotelPolicy();
  const binding = await getChannelManagerBinding();
  const pendingAri = await countPendingAriJobs();

  const [lastPush, lastPull, lastError, lastOpenError] = await Promise.all([
    prisma.outboundEventLog.findFirst({
      where: { eventType: 'channel.push' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true, lastError: true },
    }),
    prisma.outboundEventLog.findFirst({
      where: { eventType: 'channel.pull' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true, lastError: true },
    }),
    prisma.channelSyncError.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        errorMessage: true,
        status: true,
        otaReference: true,
        createdAt: true,
      },
    }),
    prisma.channelSyncError.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        errorMessage: true,
        status: true,
        otaReference: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    adapter: adapter.code,
    mode: readiness.mode,
    envReady: readiness.envReady,
    envFlags: readiness.envFlags,
    channelAutoPushEnabled: policy.channelAutoPushEnabled,
    provider: binding?.provider ?? 'off',
    live: binding?.live ?? false,
    pendingAriJobs: pendingAri,
    lastPushAt: lastPush?.createdAt ?? null,
    lastPushStatus: lastPush?.status ?? null,
    lastPullAt: lastPull?.createdAt ?? null,
    lastPullStatus: lastPull?.status ?? null,
    lastError: lastOpenError ?? lastError,
  };
}
