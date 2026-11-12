import { NextResponse } from 'next/server';
import { IbeAuthError, IbeForbiddenError, ibeCorsHeaders, ibeErrorStatus, ibePreflightHeaders, resolveIbeTenant, searchIbeAvailability } from '@/lib/channel/ibe.service';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: ibePreflightHeaders(req.headers.get('origin')),
  });
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/public/v1/availability", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const { origins, organizationId } = await resolveIbeTenant(req);
    await requireHotelModule('hotel_distribution', organizationId);
    const url = new URL(req.url);
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const nights = Number(url.searchParams.get('nights') ?? '1');
    const adults = Number(url.searchParams.get('adults') ?? '1');
    const children = Number(url.searchParams.get('children') ?? '0');
    const result = await searchIbeAvailability({ from, nights, adults, children });
    return sendJson(httpRes, result, ( {
      headers: ibeCorsHeaders(origins, req.headers.get('origin')),
    }).status ?? 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE availability failed';
    return sendJson(httpRes, { error: message }, ( { status: ibeErrorStatus(err) }).status ?? 200);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
