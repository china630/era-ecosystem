import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseFolioChargeRef } from '@era/satellite-kit/integration/folio-charge-ref';
import { markFolioChargeServiceReceived } from '@/lib/services/folio.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Canonical key plus a stored `pay-` row from before the shared contract. */
function chargeRefCandidates(externalRef: string): string[] {
  const raw = externalRef.trim();
  const parsed = parseFolioChargeRef(raw);
  const out = new Set<string>([raw]);
  if (parsed?.ref) out.add(parsed.ref);
  if (parsed?.source === 'clinic') out.add(`pay-${parsed.ref}`);
  return [...out];
}

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  externalRef: z.string().min(1),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === expected;
}

/** Clinic check-in marks the existing folio line received. Amount stays the same. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/folio-charges/received", async (httpReq, httpRes) => {
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

  if (!assertServiceToken(request)) {
    return sendJson(httpRes, { error: 'Unauthorized' }, 401);
  }
  const body = bodySchema.parse(httpReq.body);
  enterRequestTenant(body.organizationId);
  const charge = await markFolioChargeServiceReceived(chargeRefCandidates(body.externalRef));
  if (!charge) return sendJson(httpRes, { error: 'Charge not found' }, 404);
  return sendJson(httpRes, { ok: true, chargeId: charge.id });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
