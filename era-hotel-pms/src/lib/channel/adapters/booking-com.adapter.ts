import type { ChannelAdapter, OtaReservationPayload, SyncResult, AvailabilityPushRow } from '@/lib/channel/adapters/types';

function bookingComConfigured(): boolean {
  return Boolean(process.env.BOOKING_COM_API_KEY?.trim() && process.env.BOOKING_COM_HOTEL_ID?.trim());
}

/** Booking.com Connectivity API stub — wire to real endpoint when Nafta credentials available. */
export const bookingComChannelAdapter: ChannelAdapter = {
  code: 'booking_com',

  async pullReservations(since: Date): Promise<OtaReservationPayload[]> {
    if (!bookingComConfigured()) return [];
    const base = process.env.BOOKING_COM_API_BASE_URL?.replace(/\/$/, '') ?? 'https://supply-xml.booking.com';
    const res = await fetch(
      `${base}/hotels/${process.env.BOOKING_COM_HOTEL_ID}/reservations?since=${encodeURIComponent(since.toISOString())}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BOOKING_COM_API_KEY}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) throw new Error(`Booking.com pull failed: ${res.status}`);
    const json = (await res.json()) as { reservations?: OtaReservationPayload[] };
    return (json.reservations ?? []).map((r) => ({ ...r, channelCode: 'BOOKING_COM' }));
  },

  async pushAvailability(rows: AvailabilityPushRow[]): Promise<SyncResult> {
    if (!bookingComConfigured()) {
      return { ok: true, pushed: rows.length, message: 'booking_com env missing — dry-run' };
    }
    const base = process.env.BOOKING_COM_API_BASE_URL?.replace(/\/$/, '') ?? 'https://supply-xml.booking.com';
    const res = await fetch(`${base}/hotels/${process.env.BOOKING_COM_HOTEL_ID}/availability`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BOOKING_COM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, errors: [`Booking.com push ${res.status}: ${text}`] };
    }
    return { ok: true, pushed: rows.length };
  },

  async ackReservation(externalId: string): Promise<void> {
    if (!bookingComConfigured()) return;
    const base = process.env.BOOKING_COM_API_BASE_URL?.replace(/\/$/, '') ?? 'https://supply-xml.booking.com';
    await fetch(`${base}/reservations/${externalId}/ack`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.BOOKING_COM_API_KEY}` },
    });
  },
};
