import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { NextResponse } from "next/server";
import { z } from "zod";
import { copyDailyMenuBoard, findDailyMenuEntriesOnDate, listDailyMenuEntries, replaceDailyMenuBoard } from "@/lib/menu.service";
import { findOpsOutlet, resolveOpsOutlet } from "@/lib/outlet-helpers";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_DAILY_MENU } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function resolveBoardDate(raw: string | null | undefined): { ymd: string; date: Date } {
  const ymd = raw?.trim() || todayBakuYmd();
  return { ymd, date: bakuCivilUtcDate(ymd) };
}



const putSchema = z.object({
  outletCode: z.string().min(1).optional(),
  date: z.string().optional(),
  menuItemIds: z.array(z.string()).min(1),
});



const copySchema = z.object({
  outletCode: z.string().min(1).optional(),
  fromDate: z.string(),
  toDate: z.string(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/daily-menu", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_DAILY_MENU);
    if (denied) return denied;
    const url = new URL(request.url);
    const outletCodeParam = url.searchParams.get("outletCode");
    const { ymd, date } = resolveBoardDate(url.searchParams.get("date"));

    const outlet = await findOpsOutlet(outletCodeParam);
    if (!outlet) return sendJson(httpRes, { date: ymd, entries: [] });

    const entries = await listDailyMenuEntries(outlet.id, date);

    return sendJson(httpRes, {
      outletCode: outlet.code,
      date: ymd,
      entries: entries.map((e) => ({
        id: e.id,
        menuItemId: e.menuItemId,
        sortOrder: e.sortOrder,
        isFeatured: e.isFeatured,
        plu: e.menuItem.plu,
        name: e.menuItem.name,
        priceAzn: e.menuItem.priceAzn,
        category: e.menuItem.category.name,
      })),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/admin/daily-menu", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_DAILY_MENU);
    if (denied) return denied;

    const body = putSchema.parse(httpReq.body);
    const { date } = resolveBoardDate(body.date);

    const outlet = await resolveOpsOutlet(body.outletCode);

    await replaceDailyMenuBoard({
      outletId: outlet.id,
      boardDate: date,
      organizationId: outlet.organizationId,
      menuItemIds: body.menuItemIds,
    });

    return sendJson(httpRes, { ok: true, count: body.menuItemIds.length });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/daily-menu", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_DAILY_MENU);
    if (denied) return denied;

    const body = copySchema.parse(httpReq.body);
    const { date: from } = resolveBoardDate(body.fromDate);
    const { date: to } = resolveBoardDate(body.toDate);

    const outlet = await findOpsOutlet(body.outletCode);
    if (!outlet) return sendJson(httpRes, { error: "Outlet not found" }, 404);

    const source = await findDailyMenuEntriesOnDate(outlet.id, from);
    if (source.length === 0) return sendJson(httpRes, { error: "No entries on source date" }, 400);

    await copyDailyMenuBoard({
      outletId: outlet.id,
      organizationId: outlet.organizationId,
      fromDate: from,
      toDate: to,
      source,
    });

    return sendJson(httpRes, { ok: true, copied: source.length });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
