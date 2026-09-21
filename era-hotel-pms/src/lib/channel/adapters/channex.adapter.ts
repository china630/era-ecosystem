import type { ChannelAdapter, SyncResult, AvailabilityPushRow } from '@/lib/channel/adapters/types';
import { enqueueAriPush } from '@/lib/channel/channel-ari-queue.service';
import { fetchChannexClientConfig } from '@era/satellite-kit';
import { getChannelManagerBinding } from '@/lib/channel/channel-manager-binding.service';

/**
 * Channex hub — enqueue ARI (W3). Live HTTP drain via ChannelAriJob cron.
 * Partner key from CP vault; property id from org binding.
 */
export const channexChannelAdapter: ChannelAdapter = {
  code: 'channex',

  async pushAvailability(rows: AvailabilityPushRow[]): Promise<SyncResult> {
    const binding = await getChannelManagerBinding();
    if (!binding?.channexPropertyId) {
      return {
        ok: true,
        pushed: 0,
        message: 'channex property not bound — dry-run',
      };
    }
    const client = await fetchChannexClientConfig();
    if (!client.hasApiKey) {
      return {
        ok: true,
        pushed: 0,
        message: 'channex partner key missing in CP — queued skipped (dry-run)',
      };
    }
    await enqueueAriPush(rows);
    return {
      ok: true,
      pushed: rows.length,
      message: binding.live
        ? 'queued for Channex live ARI'
        : 'queued for Channex staging ARI',
    };
  },
};
