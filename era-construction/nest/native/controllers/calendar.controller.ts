import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { isConstructionWorkingDay, constructionSlaDueDate } from "@/lib/production-calendar";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const dateQuery = z.object({ date: z.string() });
const slaQuery = z.object({
  from: z.string(),
  days: z.coerce.number().int().min(0).max(90),
});

@Controller("api/calendar")
@UseGuards(ConstructionStaffGuard)
export class CalendarController {
  @Get("working-day")
  workingDay(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Query("mode") mode?: string,
    @Query("date") date?: string,
    @Query("from") from?: string,
    @Query("days") days?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (mode === "sla") {
        const params = slaQuery.parse({ from, days: days ?? "1" });
        const due = await constructionSlaDueDate(params.from, params.days);
        return {
          from: params.from,
          businessDays: params.days,
          due,
          source: "era-data-hub",
        };
      }
      const params = dateQuery.parse({ date });
      const isWorking = await isConstructionWorkingDay(params.date);
      return { date: params.date, isWorking, source: "era-data-hub" };
    });
  }
}
