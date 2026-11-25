/** Lifted from nest/generated/admin_daily-menu.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { z } from "zod";
import { copyDailyMenuBoard, findDailyMenuEntriesOnDate, listDailyMenuEntries, replaceDailyMenuBoard } from "@/lib/menu.service";
import { findOpsOutlet, resolveOpsOutlet } from "@/lib/outlet-helpers";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_DAILY_MENU } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class AdminDailyMenuController {
  @Get("api/admin/daily-menu")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_DAILY_MENU);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Put("api/admin/daily-menu")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_DAILY_MENU);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/daily-menu")
  @HttpCode(200)
  async post_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_DAILY_MENU);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
