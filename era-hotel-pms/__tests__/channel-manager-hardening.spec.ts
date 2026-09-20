import { describe, expect, it } from '@jest/globals';
import {
  hashAriPayload,
  splitAriJobs,
  canonicalizeAriRows,
} from '@/lib/channel/channel-ari-payload';
import { isChannexUuid, allowAriForBinding } from '@/lib/channel/channex-api';
import {
  normalizeChannexRevision,
  parseChannexWebhookNotification,
} from '@/lib/channel/channex-booking';
import {
  deductHoldsFromAvailable,
  holdCoversNight,
  ibeCorsHeaders,
  parseIbePublishableKey,
} from '@/lib/channel/ibe-helpers';

describe('Channex ARI split + hash (docs POST /availability + /restrictions)', () => {
  const room = '994d1375-dbbd-4072-8724-b2ab32ce781b';
  const rate = '445835fb-7956-42ac-9efc-3e6f331f0808';

  it('hashes independently of enqueue time', () => {
    const rows = [{ date: '2026-09-21', otaRoomCode: room, otaRateCode: rate, available: 3 }];
    expect(hashAriPayload('AVAILABILITY', rows)).toBe(hashAriPayload('AVAILABILITY', rows));
    expect(hashAriPayload('AVAILABILITY', rows)).not.toBe(hashAriPayload('RESTRICTIONS', rows));
  });

  it('canonical order is stable', () => {
    const a = canonicalizeAriRows([
      { date: '2026-09-22', otaRoomCode: room, available: 1 },
      { date: '2026-09-21', otaRoomCode: room, available: 2 },
    ]);
    const b = canonicalizeAriRows([
      { date: '2026-09-21', otaRoomCode: room, available: 2 },
      { date: '2026-09-22', otaRoomCode: room, available: 1 },
    ]);
    expect(a).toEqual(b);
  });

  it('drops ERA codes that are not Channex UUIDs', () => {
    expect(isChannexUuid('STD')).toBe(false);
    const split = splitAriJobs([
      { date: '2026-09-21', otaRoomCode: 'STD', otaRateCode: 'BAR', available: 2 },
      { date: '2026-09-21', otaRoomCode: room, otaRateCode: rate, available: 2, price: 100 },
    ]);
    expect(split.availability).toHaveLength(1);
    expect(split.restrictions).toHaveLength(1);
  });

  it('blocks live production ARI without CP certification flag', () => {
    expect(
      allowAriForBinding({
        live: true,
        client: {
          apiBase: 'https://app.channex.io/api/v1',
          apiKey: 'k',
          hasApiKey: true,
          pmsCertified: false,
        },
      }),
    ).toBe('not_certified');
    expect(
      allowAriForBinding({
        live: false,
        client: {
          apiBase: 'https://app.channex.io/api/v1',
          apiKey: 'k',
          hasApiKey: true,
          pmsCertified: true,
        },
      }),
    ).toBe('staging_org_blocked_from_production');
  });
});

describe('Channex booking webhook normalize', () => {
  it('parses notification envelope then revision attributes', () => {
    const note = parseChannexWebhookNotification({
      event: 'booking',
      payload: {
        booking_id: 'cfa33f3b-bd32-4b90-8ef9-bde2bfe986cd',
        property_id: '716305c4-561a-4561-a187-7f5b8aeb5920',
        revision_id: '03dd7198-c5b7-493c-a889-74d0c2211de7',
      },
    });
    expect(note.revisionId).toBe('03dd7198-c5b7-493c-a889-74d0c2211de7');
    const payload = normalizeChannexRevision({
      unique_id: 'BDC-9996013801',
      ota_reservation_code: '9996013801',
      status: 'new',
      arrival_date: '2019-04-26',
      departure_date: '2019-04-27',
      amount: '200.00',
      currency: 'EUR',
      payment_type: 'credit_card',
      occupancy: { adults: 2, children: 1, infants: 0 },
      customer: { name: 'User', surname: 'Channex', mail: 'user@channex.io' },
      rooms: [
        {
          room_type_id: '994d1375-dbbd-4072-8724-b2ab32ce781b',
          rate_plan_id: '445835fb-7956-42ac-9efc-3e6f331f0808',
        },
      ],
    });
    expect(payload.event).toBe('create');
    expect(payload.otaRoomCode).toBe('994d1375-dbbd-4072-8724-b2ab32ce781b');
    expect(payload.paymentMethod).toBe('CARD');
    expect(payload.children).toBe(1);
    expect(payload.guest.fullName).toBe('User Channex');
  });

  it('maps cancelled revision to cancel', () => {
    const payload = normalizeChannexRevision({
      unique_id: 'BDC-1',
      status: 'cancelled',
      arrival_date: '2019-04-26',
      departure_date: '2019-04-27',
      rooms: [],
    });
    expect(payload.event).toBe('cancel');
  });
});

describe('IBE hold inventory + CORS negatives', () => {
  it('deducts overlapping holds from physical availability', () => {
    expect(deductHoldsFromAvailable(3, 1)).toBe(2);
    expect(deductHoldsFromAvailable(1, 2)).toBe(0);
  });

  it('hold covers night exclusive of checkout', () => {
    const hold = {
      checkInDate: new Date('2026-09-21T00:00:00.000Z'),
      checkOutDate: new Date('2026-09-23T00:00:00.000Z'),
    };
    expect(holdCoversNight(hold, '2026-09-21')).toBe(true);
    expect(holdCoversNight(hold, '2026-09-22')).toBe(true);
    expect(holdCoversNight(hold, '2026-09-23')).toBe(false);
  });

  it('never emits wildcard CORS', () => {
    const headers = ibeCorsHeaders([], 'https://evil.example') as Record<string, string>;
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('does not read IBE key from query string', () => {
    const req = new Request('https://hotel.local/api/public/v1/availability?key=pk_leak', {
      headers: {},
    });
    expect(parseIbePublishableKey(req)).toBeNull();
    const authed = new Request('https://hotel.local/api/public/v1/availability', {
      headers: { authorization: 'Bearer pk_ok' },
    });
    expect(parseIbePublishableKey(authed)).toBe('pk_ok');
  });
});
