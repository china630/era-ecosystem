import { jsonOk } from '@/lib/api-utils';

const KNOWN_EVENTS = [
  'SATELLITE_HOTEL_RESERVATION_COMPLETED',
  'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED',
  'SATELLITE_HOTEL_FOLIO_CHARGE_POSTED',
  'SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED',
  'SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED',
] as const;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return jsonOk({ error: 'Not available in production' }, 404);
  }
  const body = (await request.json()) as { eventType?: string; correlationId?: string };
  const eventType = body.eventType ?? 'UNKNOWN';
  const known = KNOWN_EVENTS.includes(eventType as (typeof KNOWN_EVENTS)[number]);
  console.log(
    `[mock-receiver] ${eventType} correlation=${body.correlationId ?? '—'}`,
    JSON.stringify(body, null, 2),
  );
  return jsonOk({
    received: true,
    known,
    eventType,
    at: new Date().toISOString(),
  });
}
