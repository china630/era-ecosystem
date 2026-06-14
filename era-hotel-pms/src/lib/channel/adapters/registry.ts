import { stubChannelAdapter } from '@/lib/channel/adapters/stub.adapter';
import { webhookChannelAdapter } from '@/lib/channel/adapters/webhook.adapter';
import { exelyChannelAdapter } from '@/lib/channel/adapters/exely.adapter';
import { bookingComChannelAdapter } from '@/lib/channel/adapters/booking-com.adapter';
import { expediaChannelAdapter } from '@/lib/channel/adapters/expedia.adapter';
import type { ChannelAdapter } from '@/lib/channel/adapters/types';

const ADAPTERS: Record<string, ChannelAdapter> = {
  stub: stubChannelAdapter,
  webhook: webhookChannelAdapter,
  exely: exelyChannelAdapter,
  booking_com: bookingComChannelAdapter,
  expedia: expediaChannelAdapter,
};

export function resolveChannelAdapter(): ChannelAdapter {
  const key = (process.env.ERA_CHANNEL_ADAPTER ?? 'webhook').trim().toLowerCase();
  return ADAPTERS[key] ?? webhookChannelAdapter;
}

export function listChannelAdapterCodes(): string[] {
  return Object.keys(ADAPTERS);
}
