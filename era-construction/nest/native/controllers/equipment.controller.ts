import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { createEquipmentLog, listEquipmentLogs } from "@/lib/equipment-hours.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const bodySchema = z.object({
  projectId: z.string().min(1),
  equipmentCode: z.string().min(1).max(64),
  hours: z.number().min(0),
  logDate: z.string().min(1),
});

@Controller("api/equipment/hours")
@UseGuards(ConstructionStaffGuard)
export class EquipmentController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Query("projectId") projectId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (!projectId) throw new BadRequestException({ error: "projectId required" });
      return listEquipmentLogs(projectId);
    });
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = bodySchema.parse(body ?? {});
      const result = await createEquipmentLog({
        projectId: parsed.projectId,
        equipmentCode: parsed.equipmentCode,
        hours: parsed.hours,
        logDate: new Date(parsed.logDate),
      });
      return assertOk(result).row;
    });
  }
}
