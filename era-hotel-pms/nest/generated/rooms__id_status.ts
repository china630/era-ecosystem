import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { applyFrontOfficeRoomStatus } from '@/lib/services/room.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  status: z
    .enum([
      'AVAILABLE',
      'OCCUPIED',
      'DIRTY',
      'CLEAN',
      'INSPECTED',
      'OOO',
      'OOS',
      'MAINTENANCE',
      'PICKUP',
    ])
    .optional(),
  hkCondition: z.enum(['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED']).optional(),
  inventoryStatus: z.enum(['IN_SERVICE', 'OOS', 'OOO']).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/rooms/:id/status", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.ROOMS_STATUS);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const room = await applyFrontOfficeRoomStatus(id, body, { userId: session?.sub, request });
    return sendJson(httpRes, serialize(room));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
