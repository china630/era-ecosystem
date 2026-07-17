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
import { VacationSeniorityService } from "./vacation-seniority.service";
import {
  CreateVacationSeniorityRuleDto,
  UpdateVacationSeniorityRuleDto,
} from "./dto/vacation-seniority.dto";

@ApiTags("hr-vacation-seniority")
@ApiBearerAuth("bearer")
@Controller("hr/vacation-seniority-rules")
@UseGuards(RolesGuard)
export class VacationSeniorityController {
  constructor(private readonly rules: VacationSeniorityService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  @ApiOperation({ summary: "List vacation seniority rules" })
  list(@OrganizationId() organizationId: string) {
    return this.rules.list(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateVacationSeniorityRuleDto,
  ) {
    return this.rules.create(organizationId, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateVacationSeniorityRuleDto,
  ) {
    return this.rules.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.rules.remove(organizationId, id);
  }
}
