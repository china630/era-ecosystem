import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody, nestHeader } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { buildPortionListForDay } from "@/domain/diet/diet.service";
import { todayBakuYmd } from "@/lib/baku-day";
import { z } from "zod";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

@Controller()
export class DietPortionsController {
  @UseGuards(ClinicApiGuard)
  @Get("api/diet-portions")
  @HttpCode(200)
  async list(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_OPS_DAY_SUMMARY);
      if (denied) return clinicBody(denied);
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const parsed = querySchema.parse({ date: url.searchParams.get("date") ?? undefined });
      const locale =
        url.searchParams.get("locale") ?? nestHeader(httpReq, "x-era-locale") ?? "en";
      const dateYmd = parsed.date ?? todayBakuYmd();
      return await buildPortionListForDay(dateYmd, locale);
    });
  }
}