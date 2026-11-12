import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { updateRoomMasterData } from '@/lib/services/room.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  floor: z.number().int().optional(),
  description: z.string().optional().nullable(),
  viewCode: z.string().optional().nullable(),
  bedTypeCode: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  maxBed: z.number().int().optional().nullable(),
  disabled: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/rooms/:id", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.ROOMS_ADMIN);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    if (Object.keys(body).length === 0) {
      throw new Error('No fields to update');
    }
    const room = await updateRoomMasterData(id, body);
    return sendJson(httpRes, serialize(room));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
