import type { ChannelAdapter, SyncResult, AvailabilityPushRow } from '@/lib/channel/adapters/types';

export const stubChannelAdapter: ChannelAdapter = {
  code: 'stub',
  async pushAvailability(_rows: AvailabilityPushRow[]): Promise<SyncResult> {
    return { ok: true, pushed: 0, message: 'stub adapter — no outbound sync' };
  },
};
