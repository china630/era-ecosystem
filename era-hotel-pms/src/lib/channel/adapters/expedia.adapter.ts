import type { ChannelAdapter, OtaReservationPayload, SyncResult, AvailabilityPushRow } from '@/lib/channel/adapters/types';

function expediaConfigured(): boolean {
  return Boolean(process.env.EXPEDIA_API_KEY?.trim() && process.env.EXPEDIA_PROPERTY_ID?.trim());
}

/** Expedia Rapid / EPC stub adapter. */
export const expediaChannelAdapter: ChannelAdapter = {
  code: 'expedia',

  async pullReservations(since: Date): Promise<OtaReservationPayload[]> {
    if (!expediaConfigured()) return [];
    const base = process.env.EXPEDIA_API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.expediapartnercentral.com';
    const res = await fetch(
      `${base}/properties/${process.env.EXPEDIA_PROPERTY_ID}/reservations?since=${encodeURIComponent(since.toISOString())}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.EXPEDIA_API_KEY}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) throw new Error(`Expedia pull failed: ${res.status}`);
    const json = (await res.json()) as { items?: OtaReservationPayload[] };
    return (json.items ?? []).map((r) => ({ ...r, channelCode: 'EXPEDIA' }));
  },

  async pushAvailability(rows: AvailabilityPushRow[]): Promise<SyncResult> {
    if (!expediaConfigured()) {
      return { ok: true, pushed: rows.length, message: 'expedia env missing — dry-run' };
    }
    const base = process.env.EXPEDIA_API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.expediapartnercentral.com';
    const res = await fetch(`${base}/properties/${process.env.EXPEDIA_PROPERTY_ID}/availability`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EXPEDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ availability: rows }),
    });
    if (!res.ok) {
      return { ok: false, errors: [`Expedia push ${res.status}`] };
    }
    return { ok: true, pushed: rows.length };
  },
};
