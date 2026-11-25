import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { createOrUpdateProjectWithProgressAct, listProjects } from "@/lib/projects.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createSchema = z.object({
  projectCode: z.string(),
  projectName: z.string(),
  periodKey: z.string().optional(),
  amountNet: z.number().nonnegative(),
  boqLines: z
    .array(
      z.object({
        itemCode: z.string(),
        description: z.string(),
        plannedQty: z.number().positive(),
        plannedAmountNet: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
});

@Controller("api/projects")
@UseGuards(ConstructionStaffGuard)
export class ProjectsController {
  @Get()
  list(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, () => listProjects());
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = createSchema.parse(body);
      const { project, act } = await createOrUpdateProjectWithProgressAct(parsed);
      return { project, act };
    });
  }
}
