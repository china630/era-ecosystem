/** Lifted from nest/generated/dashboard_today.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { dashboardTodayBundle } from "@/lib/pos-report.service";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { businessDayBounds, currentBusinessDayKey } from "@/lib/business-day";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Café day board: current business day, closed-ticket revenue, open floor. */


@Controller()
export class DashboardTodayController {
  @Get("api/dashboard/today")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
