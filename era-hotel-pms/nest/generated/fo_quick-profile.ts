import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createQuickAgency, createQuickCompany } from '@/lib/services/quick-profile.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('AGENCY'),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(32),
  }),
  z.object({
    kind: z.literal('COMPANY'),
    name: z.string().trim().min(1).max(120),
    voen: z.string().trim().regex(/^\d{10}$/),
  }),
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/fo/quick-profile", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const body = schema.parse(httpReq.body);
    const row =
      body.kind === 'AGENCY'
        ? await createQuickAgency({ name: body.name, phone: body.phone })
        : await createQuickCompany({ name: body.name, voen: body.voen });
    return sendJson(httpRes, serialize(row));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
