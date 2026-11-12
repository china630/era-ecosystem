import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { suggestShareDoors } from '@/lib/services/share-assignment.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  reservationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Suggest compatible share doors for an unassigned share-eligible stay. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/fo/share-rooming-suggestions", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      reservationId: url.searchParams.get('reservationId'),
      limit: url.searchParams.get('limit') ?? undefined,
    });
    const suggestions = await suggestShareDoors(parsed);
    return sendJson(httpRes, serialize(suggestions));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
