import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestHeader,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getOpsDaySummary } from "@/domain/ops/day-summary.service";


const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  date: ymd.optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});

@Controller()
export class OpsDaySummaryController {

  @UseGuards(ClinicApiGuard)
  @Get("api/ops/day-summary")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_OPS_DAY_SUMMARY);
    if (denied) return clinicBody(denied);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const parsed = querySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const locale =
      url.searchParams.get("locale") ??
      nestHeader(httpReq, "x-era-locale") ??
      "en";

    return await getOpsDaySummary(parsed.date, locale, {
        from: parsed.from,
        to: parsed.to,
      });
  
        });
  }
}
