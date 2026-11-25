import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { todayBakuYmd } from "@/lib/baku-day";
import { loadPaidPunchReport, type PaidPunchKind } from "@/domain/reports/paid-punch-report";


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const kindSchema = z.enum(["procedure", "lab", "diagnostic", ""]);

@Controller()
export class ReportsPaidPunchesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/paid-punches")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return clinicBody(denied);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const today = todayBakuYmd();
    const from = (url.searchParams.get("from") ?? `${today.slice(0, 8)}01`).trim();
    const to = (url.searchParams.get("to") ?? today).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new HttpException({ error: "from and to must be YYYY-MM-DD" }, 400);
    }
    const kind = kindSchema.parse((url.searchParams.get("kind") ?? "").trim()) as PaidPunchKind | "";
    const report = await loadPaidPunchReport({
      from,
      to,
      kind,
      room: url.searchParams.get("room") ?? "",
      guest: url.searchParams.get("guest") ?? "",
      code: url.searchParams.get("code") ?? "",
      doctorId: url.searchParams.get("doctorId") ?? "",
      cashierId: url.searchParams.get("cashierId") ?? "",
      locale: url.searchParams.get("locale") ?? "az",
    });
    return report;
  
        });
  }
}
