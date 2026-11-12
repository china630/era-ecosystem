import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createRoom, listRoomsMaster } from '@/lib/services/room.service';
import { listRoomsForRack } from '@/lib/services/room-rack.service';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  roomNumber: z.string().min(1),
  roomTypeId: z.string().uuid(),
  floor: z.number().int().optional(),
  description: z.string().optional(),
  viewCode: z.string().optional(),
  bedTypeCode: z.string().optional(),
  location: z.string().optional(),
  maxBed: z.number().int().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/rooms", async (httpReq, httpRes) => {
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

  
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope === 'master') {
      assertPermission(session, PERMISSIONS.ROOMS_ADMIN);
      return sendJson(httpRes, serialize(await listRoomsMaster()));
    }
    assertAnyPermission(session, [
      PERMISSIONS.ROOMS_LIST,
      PERMISSIONS.ROOMS_STATUS,
      PERMISSIONS.HOUSEKEEPING_MANAGE,
    ]);
    const rooms = await listRoomsForRack();
    return sendJson(httpRes, serialize(rooms));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/rooms", async (httpReq, httpRes) => {
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
    const body = createSchema.parse(httpReq.body);
    const room = await createRoom(body);
    return sendJson(httpRes, serialize(room), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
