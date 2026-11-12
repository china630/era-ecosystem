
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const KNOWN_EVENTS = [
  'SATELLITE_HOTEL_RESERVATION_COMPLETED',
  'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED',
  'SATELLITE_HOTEL_FOLIO_CHARGE_POSTED',
  'SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED',
  'SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED',
] as const;

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/mock-receiver", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  if (process.env.NODE_ENV === 'production') {
    return sendJson(httpRes, { error: 'Not available in production' }, 404);
  }
  const body = (httpReq.body) as { eventType?: string; correlationId?: string };
  const eventType = body.eventType ?? 'UNKNOWN';
  const known = KNOWN_EVENTS.includes(eventType as (typeof KNOWN_EVENTS)[number]);
  console.log(
    `[mock-receiver] ${eventType} correlation=${body.correlationId ?? '—'}`,
    JSON.stringify(body, null, 2),
  );
  return sendJson(httpRes, {
    received: true,
    known,
    eventType,
    at: new Date().toISOString(),
  });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
