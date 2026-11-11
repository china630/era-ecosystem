import { z } from "zod";
import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { handoverOutletAndTickets } from "@/lib/pos-report.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  outletId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Room list and cash act for one outlet day. Only checks already closed. Signatures stay on paper. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/handover", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return denied;
    const url = new URL(request.url);
    const q = querySchema.parse({
      outletId: url.searchParams.get("outletId") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    const outletId = q.outletId ?? (await getSelectedOutletId());
    if (!outletId) return sendJson(httpRes, { error: "Select an outlet" }, 400);
    const ymd = q.date ?? todayBakuYmd();
    const { start, end } = bakuDayBounds(ymd);
    const { outlet, closed } = await handoverOutletAndTickets(outletId, start, end);
    if (!outlet) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    const rooms = closed
      .filter((t) => t.tenderRoute === "ROOM" || t.roomChargeReservationId || t.roomNumberLabel)
      .map((t) => ({
        ticketId: t.id,
        room: t.roomNumberLabel || t.roomChargeReservationId,
        guest: t.guestName,
        amount: Number(t.totalAzn),
      }));
    const sum = (route: string) =>
      Math.round(
        closed
          .filter((t) => (t.tenderRoute || t.paymentMethod || "").toUpperCase() === route)
          .reduce((s, t) => s + Number(t.totalAzn), 0) * 100,
      ) / 100;
    return sendJson(httpRes, {
      outlet: { id: outlet.id, code: outlet.code, name: outlet.name },
      businessDay: ymd,
      roomHandover: rooms,
      roomTotal: Math.round(rooms.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      cashAct: {
        cash: sum("CASH"),
        ikram: sum("IKRAM"),
        limit: sum("LIMIT"),
        card: sum("CARD"),
      },
      signatures: "paper",
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
