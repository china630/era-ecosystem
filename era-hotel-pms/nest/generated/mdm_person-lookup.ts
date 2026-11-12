import { z } from 'zod';
import { lookupGlobalPersonByFin, resolvePersonIdentity } from '@era/satellite-kit';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { buildMdmPersonLookupBody } from '@/lib/mdm-person-lookup-body';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: 'fullName or firstName+lastName required' },
  );

/** Resolve MDM global person id from FIN / passport (SP7 guest linkage). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/mdm/person-lookup", async (httpReq, httpRes) => {
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
    const parsed = schema.safeParse(httpReq.body);
    if (!parsed.success) {
      return sendJson(httpRes, { error: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
    }
    const body = parsed.data;
    if (body.fin) {
      const result = await lookupGlobalPersonByFin(body.fin);
      if (result.globalPersonId) return sendJson(httpRes, result);
    }
    const resolveBody = buildMdmPersonLookupBody(body);
    const resolved = await resolvePersonIdentity(resolveBody);
    return sendJson(httpRes, {
      globalPersonId: resolved.globalPersonId,
      masked: false,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
