import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { listBoqLines, upsertBoqLine } from "@/lib/boq.service";
import { findProjectById } from "@/lib/projects.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const upsertSchema = z.object({
  itemCode: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  plannedQty: z.number().positive(),
  plannedAmountNet: z.number().nonnegative().optional(),
});

@Controller("api/projects/:id/boq")
@UseGuards(ConstructionStaffGuard)
export class BoqController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const project = await findProjectById(id);
      if (!project) throw new NotFoundException({ error: "Project not found" });
      return listBoqLines(id);
    });
  }

  @Post()
  @HttpCode(201)
  upsert(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = upsertSchema.parse(body ?? {});
      const result = await upsertBoqLine(id, parsed);
      return assertOk(result).line;
    });
  }
}
