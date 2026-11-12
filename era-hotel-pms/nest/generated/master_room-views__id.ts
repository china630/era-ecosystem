import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { updateRoomView } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  active: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/master/room-views/:id", async (httpReq, httpRes) => {
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
    return sendJson(httpRes, serialize(await updateRoomView(id, body)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
