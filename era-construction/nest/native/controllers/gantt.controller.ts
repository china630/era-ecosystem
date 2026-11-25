import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { findProjectById } from "@/lib/projects.service";
import { createProjectTask, listProjectTasks, softDeleteProjectTask } from "@/lib/gantt.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

@Controller("api/projects/:id/gantt")
@UseGuards(ConstructionStaffGuard)
export class GanttController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const project = await findProjectById(id);
      if (!project) throw new NotFoundException({ error: "Project not found" });
      const tasks = await listProjectTasks(id);
      return { projectId: id, tasks };
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
      const parsed = z
        .object({
          name: z.string().min(1).max(200),
          startDate: z.string().min(1),
          endDate: z.string().min(1),
          progressPct: z.number().int().min(0).max(100).optional(),
          dependsOnId: z.string().optional().nullable(),
        })
        .parse(body ?? {});
      const result = await createProjectTask(id, {
        name: parsed.name,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        progressPct: parsed.progressPct,
        dependsOnId: parsed.dependsOnId,
      });
      return assertOk(result).row;
    });
  }

  @Delete()
  remove(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Query("taskId") taskId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (!taskId) throw new BadRequestException({ error: "taskId required" });
      const result = await softDeleteProjectTask(id, taskId);
      return assertOk(result).row;
    });
  }
}
