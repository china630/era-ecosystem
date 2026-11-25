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
import {
  createDraftProgressAct,
  listProgressActsForProject,
} from "@/lib/progress-acts.service";
import { findProjectById } from "@/lib/projects.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createSchema = z.object({
  periodKey: z.string().max(64).optional(),
  amountNet: z.number().nonnegative().optional(),
});

@Controller("api/projects/:id/acts")
@UseGuards(ConstructionStaffGuard)
export class ActsController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const project = await findProjectById(id);
      if (!project) throw new NotFoundException({ error: "Project not found" });
      return listProgressActsForProject(id);
    });
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
      const result = await createDraftProgressAct(id, parsed);
      return assertOk(result).act;
    });
  }
}
