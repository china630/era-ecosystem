import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assignVehicle, cancelTransfer, completeTransfer } from '@/lib/services/transfer.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    vehicleId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('complete'),
  }),
  z.object({
    action: z.literal('cancel'),
    reason: z.string().max(200).optional(),
  }),
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/transfers/:id", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    const result =
      body.action === 'assign'
        ? await assignVehicle(id, body.vehicleId)
        : body.action === 'complete'
          ? await completeTransfer(id)
          : await cancelTransfer(id, body.reason);

    return sendJson(httpRes, serialize(result));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
