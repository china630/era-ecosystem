import { z } from "zod";
import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { journalTicketBundles } from "@/lib/pos-report.service";
import { daySeqMap } from "@/lib/ticket-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  outletId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function tone(route: string): "till" | "room" | "limit" | "ikram" | "other" {
  if (route === "CASH" || route === "CARD" || route === "TRANSFER") return "till";
  if (route === "ROOM") return "room";
  if (route === "LIMIT") return "limit";
  if (route === "IKRAM") return "ikram";
  return "other";
}

/** Manager day journal. Waiters do not have screen:sales. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/journal", async (httpReq, httpRes) => {
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
    const { closed, open, holders } = await journalTicketBundles(outletId, start, end);
    const names = new Map(holders.map((h) => [h.id, h.displayName]));
    const organizationId = requestOrganizationId();
    const dayNos = organizationId ? await daySeqMap(organizationId) : new Map<string, number>();
    const mapRow = (row: (typeof closed)[number], openCheck: boolean) => {
      const route = (row.tenderRoute || row.paymentMethod || (openCheck ? "OPEN" : "UNKNOWN")).toUpperCase();
      const cash = route === "CASH" ? Number(row.totalAzn) : 0;
      const card = route === "CARD" ? Number(row.totalAzn) : 0;
      return {
        id: row.id,
        dayNo: dayNos.get(row.id) ?? null,
        open: openCheck,
        table: row.table?.code ?? row.table?.name ?? null,
        openedAt: row.openedAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
        cash,
        card,
        discountPercent: Number(row.discountPercent),
        total: Number(row.totalAzn),
        room: row.roomNumberLabel,
        guestName: row.guestName,
        holder: row.limitHolderId ? names.get(row.limitHolderId) ?? row.limitHolderId : null,
        terminal: row.cardTerminalLabel,
        voidedTicketId: null as string | null,
        route,
        tone: openCheck ? "other" : tone(route),
      };
    };
    return sendJson(httpRes, {
      businessDay: ymd,
      rows: [...open.map((row) => mapRow(row, true)), ...closed.map((row) => mapRow(row, false))],
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
