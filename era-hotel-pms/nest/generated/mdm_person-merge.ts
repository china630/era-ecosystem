import { z } from 'zod';
import { mergePersonRecords } from '@era/satellite-kit';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { linkGuestGlobalPerson } from '@/lib/services/guest.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  guestId: z.string(),
  sourcePersonId: z.string().uuid(),
  targetPersonId: z.string().uuid(),
  fin: z.string().trim().min(7),
  fullName: z.string().trim().min(1),
  nationality: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/mdm/person-merge", async (httpReq, httpRes) => {
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
    const merged = await mergePersonRecords(body.sourcePersonId, body.targetPersonId);
    if (!merged.globalPersonId) {
      throw new Error('MDM merge failed');
    }
    return sendJson(httpRes, await linkGuestGlobalPerson(body.guestId, merged.globalPersonId));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
