import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestHeader,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { getEpisodeSchedule } from "@/lib/services/sanatorium.service";
import { bakuDateKey, bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";


function parseDayYmd(value: string | null): string {
  if (!value?.trim()) return todayBakuYmd();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return bakuDateKey(new Date(trimmed));
}

@Controller()
export class SanatoriumEpisodesIdScheduleController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id/schedule")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const fromYmd = parseDayYmd(url.searchParams.get("from"));
    const { start: from, end: fromEnd } = bakuDayBounds(fromYmd);
    const toParam = url.searchParams.get("to");
    const to = toParam ? bakuDayBounds(parseDayYmd(toParam)).start : fromEnd;

    const orders = await getEpisodeSchedule(
      id,
      from,
      to,
      url.searchParams.get("locale") ?? nestHeader(httpReq, "x-era-locale") ?? "en",
    );
    return orders;
  
        });
  }
}
