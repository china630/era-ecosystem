import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listDiagnosisReport } from "@/domain/icd/diagnosis-report.service";

@Controller()
export class ReportsDiagnosesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/diagnoses")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_DIAGNOSES);
    if (denied) return clinicBody(denied);

        const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new HttpException({ error: "from and to must be YYYY-MM-DD" }, 400);
    }
    const source = url.searchParams.get("source") ?? "all";
    const chapter = url.searchParams.get("chapter") ?? "";
    const locale = url.searchParams.get("locale") ?? "en";
    return await listDiagnosisReport({
        fromYmd: from,
        toYmd: to,
        source:
          source === "episode" || source === "visit" || source === "admission"
            ? source
            : "all",
        chapter: chapter || undefined,
        locale,
      });
  
        });
  }
}
