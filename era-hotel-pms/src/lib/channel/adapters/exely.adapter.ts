import type { ChannelAdapter, OtaReservationPayload, SyncResult, AvailabilityPushRow } from '@/lib/channel/adapters/types';

function exelyBaseUrl(): string | null {
  const url = process.env.EXELY_API_BASE_URL?.trim();
  return url || null;
}

function exelyHeaders(): Record<string, string> | null {
  const apiKey = process.env.EXELY_API_KEY?.trim();
  const propertyId = process.env.EXELY_PROPERTY_ID?.trim();
  if (!apiKey || !propertyId) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Property-Id': propertyId,
  };
}

/** Exely hub client — active when EXELY_* env is set; otherwise falls back to webhook behaviour. */
export const exelyChannelAdapter: ChannelAdapter = {
  code: 'exely',

  async pullReservations(since: Date): Promise<OtaReservationPayload[]> {
    const base = exelyBaseUrl();
    const headers = exelyHeaders();
    if (!base || !headers) return [];

    const url = `${base.replace(/\/$/, '')}/reservations?since=${encodeURIComponent(since.toISOString())}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Exely pull failed: ${res.status}`);
    }
    const json = (await res.json()) as { items?: OtaReservationPayload[] };
    return json.items ?? [];
  },

  async pushAvailability(rows: AvailabilityPushRow[]): Promise<SyncResult> {
    const base = exelyBaseUrl();
    const headers = exelyHeaders();
    if (!base || !headers) {
      return {
        ok: true,
        pushed: rows.length,
        message: 'exely env missing — treated as webhook dry-run',
      };
    }

    const url = `${base.replace(/\/$/, '')}/availability`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, errors: [`Exely push ${res.status}: ${text}`] };
    }
    return { ok: true, pushed: rows.length };
  },
};
