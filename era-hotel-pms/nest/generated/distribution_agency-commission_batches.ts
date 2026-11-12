import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createCommissionBatch } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  agencyId: z.string().min(1),
  periodFrom: z.string().min(8).optional(),
  periodTo: z.string().min(8).optional(),
  lineIds: z.array(z.string().min(1)).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/distribution/agency-commission/batches", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.AGENCY_COMMISSION_ADMIN);
    const body = schema.parse(httpReq.body);
    const from = body.periodFrom ?? todayBakuYmd();
    const to = body.periodTo ?? from;
    const batch = await createCommissionBatch({
      agencyId: body.agencyId,
      periodFromYmd: from,
      periodToYmd: to,
      lineIds: body.lineIds,
    });
    return sendJson(httpRes, serialize(batch));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
