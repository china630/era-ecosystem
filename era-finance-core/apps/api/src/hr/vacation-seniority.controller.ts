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
import { VacationSeniorityService } from "./vacation-seniority.service";
import {
  CreateVacationSeniorityRuleDto,
  UpdateVacationSeniorityRuleDto,
} from "./dto/vacation-seniority.dto";

@ApiTags("hr-vacation-seniority")
@ApiBearerAuth("bearer")
@Controller("hr/vacation-seniority-rules")
@UseGuards(PermissionsGuard)
export class VacationSeniorityController {
  constructor(private readonly rules: VacationSeniorityService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "List vacation seniority rules" })
  list(@OrganizationId() organizationId: string) {
    return this.rules.list(organizationId);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateVacationSeniorityRuleDto,
  ) {
    return this.rules.create(organizationId, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateVacationSeniorityRuleDto,
  ) {
    return this.rules.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.rules.remove(organizationId, id);
  }
}
