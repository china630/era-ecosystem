import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { createDailyLog, listDailyLogs, submitDailyLog } from "@/lib/daily-logs.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createSchema = z.object({
  logDate: z.string(),
  weather: z.string().optional(),
  crewCount: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  reportedBy: z.string().optional(),
  crewByPartyJson: z.string().max(8000).optional(),
  equipmentNotes: z.string().max(2000).optional(),
  photoUrl: z.string().max(2048).optional(),
});

const patchSchema = z.object({
  logId: z.string().min(1),
  action: z.literal("SUBMIT"),
});

@Controller("api/projects/:id/daily-logs")
@UseGuards(ConstructionStaffGuard)
export class DailyLogsController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => listDailyLogs(id));
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = createSchema.parse(body ?? {});
      const result = await createDailyLog(id, {
        logDate: new Date(parsed.logDate),
        weather: parsed.weather,
        crewCount: parsed.crewCount,
        notes: parsed.notes,
        reportedBy: parsed.reportedBy,
        crewByPartyJson: parsed.crewByPartyJson,
        equipmentNotes: parsed.equipmentNotes,
        photoUrl: parsed.photoUrl,
      });
      return assertOk(result).row;
    });
  }

  @Patch()
  submit(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = patchSchema.parse(body ?? {});
      const result = await submitDailyLog(id, parsed.logId);
      return assertOk(result).row;
    });
  }
}
