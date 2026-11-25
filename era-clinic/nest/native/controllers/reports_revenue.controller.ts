import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { loadRevenueStatement } from "@/domain/reports/load-revenue-statement";


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
export class ReportsRevenueController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/revenue")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return clinicBody(denied);
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new HttpException({ error: "from and to must be YYYY-MM-DD" }, 400);
    }
    const { start } = bakuDayBounds(from);
    const { end } = bakuDayBounds(to);
    const items = await loadRevenueStatement(start, end);
    const grandTotal = Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
    return { items, grandTotal };
  
        });
  }
}
