import { Controller, Get, HttpCode, Put, Req, UseGuards, HttpException } from "@nestjs/common";
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
import { normalizeSchedule } from "@/domain/reports/bonus-schedule";
import { computeBonusMonth, loadBonusReportPractitioners, loadBonusSchedule, saveBonusSchedule } from "@/domain/reports/bonus-compute";


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;



const share = z.object({ refer: z.number(), perform: z.number() });
const table = z.object({
  consult: share,
  physio: share,
  massage: share,
  lab: share,
  func: share,
  lfk: share,
  cosmo: share,
});

const bodySchema = z.object({
  vatPercent: z.number(),
  profitTaxPercent: z.number(),
  fundPercent: z.number(),
  labPractitionerId: z.string().nullable(),
  usPractitionerId: z.string().nullable(),
  coefficients: z.record(z.string(), z.number()),
  memberIds: z.array(z.string()).optional(),
  walkIn: table,
  inHouse: table,
});

@Controller()
export class ReportsBonusController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/bonus")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return clinicBody(denied);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new HttpException({ error: "from and to must be YYYY-MM-DD" }, 400);
    const schedule = await loadBonusSchedule();
    const [month, people] = await Promise.all([
      computeBonusMonth(from, to),
      loadBonusReportPractitioners(schedule),
    ]);
    return { schedule, month, people };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Put("api/reports/bonus")
  @HttpCode(200)
  async put_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return clinicBody(denied);
    const schedule = normalizeSchedule(bodySchema.parse(httpReq.body));
    await saveBonusSchedule(schedule);
    return { schedule };
  
        });
  }
}
