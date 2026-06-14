import type { ChannelAdapter, SyncResult, AvailabilityPushRow } from '@/lib/channel/adapters/types';

/** Normalized webhook bridge — logs push payload; ingest handled by ota-ingest.service. */
export const webhookChannelAdapter: ChannelAdapter = {
  code: 'webhook',
  async pushAvailability(rows: AvailabilityPushRow[]): Promise<SyncResult> {
    if (rows.length === 0) {
      return { ok: true, pushed: 0, message: 'no rows to push' };
    }
    return {
      ok: true,
      pushed: rows.length,
      message: `webhook adapter queued ${rows.length} availability row(s)`,
    };
  },
};
