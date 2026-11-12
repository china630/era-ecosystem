import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { updateRoomType } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  baseQuota: z.number().int().positive().optional(),
  overbookAllowance: z.number().int().nonnegative().optional(),
  adultCapacity: z.number().int().optional(),
  standardAdults: z.number().int().min(1).max(10).optional(),
  childCapacity: z.number().int().optional(),
  active: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/master/room-types/:id", async (httpReq, httpRes) => {
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

  
    assertMasterDataWrite(session, PERMISSIONS.ROOMS_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const updated = await updateRoomType(id, body, { userId: session?.sub });
    if (body.active === false) {
      await recordHotelAudit(
        { userId: session?.sub, request },
        'RoomType',
        id,
        'RETIRE',
        { patch: body },
      );
    }
    return sendJson(httpRes, serialize(updated));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
