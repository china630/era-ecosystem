import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { dashboardTodayBundle } from "@/lib/pos-report.service";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { businessDayBounds, currentBusinessDayKey } from "@/lib/business-day";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Café day board: current business day, closed-ticket revenue, open floor. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/dashboard/today", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return denied;

    const profile = await getFnbOrgProfile();
    const day = currentBusinessDayKey(new Date(), profile.businessDayStart);
    const { start, end } = businessDayBounds(day, profile.businessDayStart);
    const { openedToday, openNow, occupiedTables, closed } = await dashboardTodayBundle(start, end);

    let revenueAzn = 0;
    const qtyByName = new Map<string, number>();
    const qtyBySection = new Map<string, number>();
    for (const ticket of closed) {
      revenueAzn += Number(ticket.totalAzn);
      for (const line of ticket.lines) {
        const name = line.description.trim() || "—";
        qtyByName.set(name, (qtyByName.get(name) ?? 0) + line.qty);
        const section = line.menuItem?.category?.name?.trim();
        if (section) qtyBySection.set(section, (qtyBySection.get(section) ?? 0) + line.qty);
      }
    }

    const topDishes = [...qtyByName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const topSections = [...qtyBySection.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return sendJson(httpRes, {
      date: day,
      openedToday,
      openNow,
      occupiedTables,
      revenueAzn,
      topDishes,
      topSections,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
