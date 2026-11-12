import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { proposeRosterWeek, setRosterCell, reorderHousekeepers, moveHousekeeperDepartment, listHousekeepersForRoster, getRosterWeekByStart } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const propose = z.object({ weekStart: z.string(), action: z.literal('propose').optional() });
const cell = z.object({
  cellId: z.string().uuid(),
  kind: z.enum(['E', 'L', 'N', 'OFF', 'EG', 'CUSTOM']),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/housekeeping/roster", async (httpReq, httpRes) => {
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
    const weekStart = new URL(request.url).searchParams.get('weekStart');
    if (!weekStart) {
      const maids = await listHousekeepersForRoster();
      return sendJson(httpRes, serialize(maids));
    }
    const week = await getRosterWeekByStart(weekStart);
    return sendJson(httpRes, serialize(week));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/housekeeping/roster", async (httpReq, httpRes) => {
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
    if (Array.isArray(body.orderedIds)) {
      await reorderHousekeepers(body.orderedIds.map(String));
      return sendJson(httpRes, { ok: true });
    }
    if (body.housekeeperId && body.department) {
      return sendJson(httpRes, 
        serialize(
          await moveHousekeeperDepartment(
            String(body.housekeeperId),
            body.department as 'ROOMS' | 'PUBLIC_AREA' | 'LAUNDRY',
          ),
        ),
      );
    }
    if (body.cellId) {
      const data = cell.parse(body);
      return sendJson(httpRes, serialize(await setRosterCell(data.cellId, data.kind, data.customStart, data.customEnd)));
    }
    const data = propose.parse(body);
    return sendJson(httpRes, serialize(await proposeRosterWeek(data.weekStart)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
