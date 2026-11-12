import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listBarRates, bulkUpsertBarRates } from '@/lib/services/bar-rates.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bulkSchema = z.object({
  ratePlanId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  amount: z.number().positive(),
  currencyCode: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/master/bar-rates", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertMasterDataRead(session, PERMISSIONS.RATES_ADMIN);
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    return sendJson(httpRes, 
      serialize(
        await listBarRates({
          ratePlanId: params.get('ratePlanId') ?? undefined,
          roomTypeId: params.get('roomTypeId') ?? undefined,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        }),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/master/bar-rates", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const body = bulkSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await bulkUpsertBarRates(body)), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
