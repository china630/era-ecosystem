import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { z } from "zod";
import { createTableReservation, listTableReservationsForDay } from "@/lib/fnb-reservation.service";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { HOTEL_READ_RESERVATIONS } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  tableId: z.string(),
  startAt: z.string().datetime({ offset: true }).or(z.string()),
  endAt: z.string(),
  guestName: z.string().optional(),
  partySize: z.number().int().positive().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reservations", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_RESERVATIONS);
    if (denied) return denied;
    await assertHotelFnbFeature("reservations");
    const dateYmd = new URL(request.url).searchParams.get("date") ?? todayBakuYmd();
    const { start: dayStart, end: dayEnd } = bakuDayBounds(dateYmd);

    const rows = await listTableReservationsForDay(dayStart, dayEnd);
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/reservations", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.RESERVATIONS_OPEN_TICKET,
    );
    if (denied) return denied;
    await assertHotelFnbFeature("reservations");
    const body = createSchema.parse(httpReq.body);
    const row = await createTableReservation({
      tableId: body.tableId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      guestName: body.guestName,
      partySize: body.partySize ?? 2,
    });
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
