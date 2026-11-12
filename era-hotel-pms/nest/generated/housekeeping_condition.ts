import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { setHousekeepingCondition } from '@/lib/services/room.service';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import type { RoomHkCondition } from '@prisma/client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  roomId: z.string().uuid(),
  hkCondition: z.enum(['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED']),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/housekeeping/condition", async (httpReq, httpRes) => {
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

  
    assertAnyPermission(session, [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS]);
    const body = schema.parse(httpReq.body);
    const allowOccupiedHk = sessionHasHotelPermission(
      {
        login: session.login,
        email: session.email,
        role: session.role,
        permissions: session.permissions,
        isOwner: session.isOwner,
      },
      PERMISSIONS.HOUSEKEEPING_MANAGE,
    );
    const updated = await setHousekeepingCondition(
      body.roomId,
      body.hkCondition as RoomHkCondition,
      { userId: session.sub, request },
      allowOccupiedHk,
    );
    return sendJson(httpRes, serialize(updated));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
