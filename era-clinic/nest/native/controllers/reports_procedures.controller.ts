import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission, sessionHasClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { todayBakuYmd } from "@/lib/baku-day";
import { runProcedureReport } from "@/domain/reports/procedure-report.service";


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const viewSchema = z.enum([
  "fulfillment",
  "doctor-lines",
  "doctor-bonus",
  "by-procedure",
  "nurse-work",
]);

@Controller()
export class ReportsProceduresController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/procedures")
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
    const viewRaw = (url.searchParams.get("view") ?? "fulfillment").trim();
    const view = viewSchema.parse(viewRaw);

    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new HttpException({ error: "from and to must be YYYY-MM-DD" }, 400);
    }

    const procedureCode = url.searchParams.get("procedure")?.trim() || undefined;
    const paid = url.searchParams.get("paid")?.trim();
    const origin = url.searchParams.get("origin")?.trim() || undefined;
    const doctorIdParam = url.searchParams.get("doctorId")?.trim() || undefined;
    const nurseIdParam = url.searchParams.get("nurseId")?.trim() || undefined;
    const statusFilter = url.searchParams.get("status")?.trim();

    const isNurseDesk = sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_NURSE);

    const payload = await runProcedureReport({
      view,
      from,
      to,
      procedureCode,
      paid,
      origin,
      doctorId: doctorIdParam,
      nurseId: nurseIdParam,
      statusFilter,
      sessionUserId: session.sub,
      isNurseDesk,
    });

    return payload;
  
        });
  }
}
