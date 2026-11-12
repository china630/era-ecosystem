import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { assignTaskHousekeeper, createHousekeeper, deactivateHousekeeper, listHousekeepers, updateHousekeeperDepartment } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  globalPersonId: z.string().uuid(),
  name: z.string().min(1),
  department: z.enum(['ROOMS', 'PUBLIC_AREA', 'LAUNDRY']).optional(),
});
const assignSchema = z.object({ taskId: z.string().uuid(), housekeeperId: z.string().uuid().nullable() });
const patchSchema = z.object({
  id: z.string().uuid(),
  department: z.enum(['ROOMS', 'PUBLIC_AREA', 'LAUNDRY']).optional(),
  active: z.literal(false).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/housekeeping/maids", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return sendJson(httpRes, serialize(await listHousekeepers()));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/housekeeping/maids", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (body.taskId) {
      const parsed = assignSchema.parse(body);
      return sendJson(httpRes, serialize(await assignTaskHousekeeper(parsed.taskId, parsed.housekeeperId)));
    }
    if (body.id && (body.department != null || body.active === false)) {
      const parsed = patchSchema.parse(body);
      if (parsed.active === false) {
        return sendJson(httpRes, serialize(await deactivateHousekeeper(parsed.id)));
      }
      if (parsed.department) {
        return sendJson(httpRes, serialize(await updateHousekeeperDepartment(parsed.id, parsed.department)));
      }
    }
    const parsed = createSchema.parse(body);
    return sendJson(httpRes, serialize(await createHousekeeper(parsed)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
