import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { holdCommissionLine, releaseCommissionHold } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z
  .object({
    reason: z.string().optional(),
    release: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.release) return;
    if (!val.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hold reason required',
        path: ['reason'],
      });
    }
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/distribution/agency-commission/lines/:id/hold", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    if (body.release) {
      return sendJson(httpRes, serialize(await releaseCommissionHold(id)));
    }
    return sendJson(httpRes, serialize(await holdCommissionLine(id, body.reason!.trim())));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
