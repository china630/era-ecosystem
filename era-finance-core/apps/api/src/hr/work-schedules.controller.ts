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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { WorkSchedulesService } from "./work-schedules.service";
import {
  CreateWorkScheduleDto,
  UpdateWorkScheduleDto,
} from "./dto/work-schedule.dto";

@ApiTags("hr-work-schedules")
@ApiBearerAuth("bearer")
@Controller("hr/work-schedules")
@UseGuards(RolesGuard)
export class WorkSchedulesController {
  constructor(private readonly schedules: WorkSchedulesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  @ApiOperation({ summary: "List work schedules" })
  list(@OrganizationId() organizationId: string) {
    return this.schedules.list(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWorkScheduleDto,
  ) {
    return this.schedules.create(organizationId, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    return this.schedules.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.schedules.remove(organizationId, id);
  }
}
