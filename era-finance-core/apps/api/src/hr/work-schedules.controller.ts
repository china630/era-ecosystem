import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { WorkSchedulesService } from "./work-schedules.service";
import {
  CreateWorkScheduleDto,
  UpdateWorkScheduleDto,
} from "./dto/work-schedule.dto";

@ApiTags("hr-work-schedules")
@ApiBearerAuth("bearer")
@Controller("hr/work-schedules")
@UseGuards(PermissionsGuard)
export class WorkSchedulesController {
  constructor(private readonly schedules: WorkSchedulesService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "List work schedules" })
  list(@OrganizationId() organizationId: string) {
    return this.schedules.list(organizationId);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWorkScheduleDto,
  ) {
    return this.schedules.create(organizationId, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    return this.schedules.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.schedules.remove(organizationId, id);
  }
}
