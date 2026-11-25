import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
} from "../../bridge";
import { hasBusinessOwnerRole } from "@/lib/api-utils";
import { getCapacitySummary } from "@/lib/capacity.service";
import { executiveDayBlocks } from "@/domain/ops/executive-day.service";
import { countExecutiveRangeMetrics } from "@/domain/ops/day-summary.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";


function resolveRangeBounds(input: { date?: string; from?: string; to?: string }) {
  const fromYmd = (input.from ?? input.date)?.trim() || todayBakuYmd();
  const toYmd = (input.to ?? input.date)?.trim() || fromYmd;
  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  const { start } = bakuDayBounds(lo);
  const { end } = bakuDayBounds(hi);
  return { ymd: hi, start, end };
}

@Controller()
export class ExecutiveSummaryController {

  @UseGuards(ClinicApiGuard)
  @Get("api/executive/summary")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    if (!hasBusinessOwnerRole(session)) {
      throw new HttpException({ error: "BUSINESS_OWNER required" }, 403);
    }

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const { ymd, start, end } = resolveRangeBounds({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const [{ visitsToday, openLabOrders }, blocks, capacity] = await Promise.all([
      countExecutiveRangeMetrics({ start, end }),
      executiveDayBlocks({
        from: start,
        to: end,
      }),
      getCapacitySummary(start),
    ]);

    return {
      date: ymd,
      visitsToday,
      blocks,
      openLabOrders,
      currency: "AZN",
      capacity,
    };
  
        });
  }
}
