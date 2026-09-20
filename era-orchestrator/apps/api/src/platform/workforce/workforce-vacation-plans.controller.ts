import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreateWorkforceVacationPlanDto,
  ListWorkforceVacationPlansQueryDto,
  RejectWorkforceVacationPlanDto,
  UpdateWorkforceVacationPlanDto,
} from "./dto/workforce-vacation-plan.dto";
import { WorkforceVacationPlansService } from "./workforce-vacation-plans.service";

@ApiTags("platform-workforce-vacation-plans")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/vacation-plans")
@UseGuards(PermissionsGuard)
export class WorkforceVacationPlansController {
  constructor(private readonly plans: WorkforceVacationPlansService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List workforce vacation plans" })
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListWorkforceVacationPlansQueryDto,
  ) {
    return this.plans.list(organizationId, query);
  }

  @Get(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Vacation plan detail" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.plans.getOne(organizationId, id);
  }

  @Post()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Create vacation plan (DRAFT or SUBMITTED)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceVacationPlanDto,
  ) {
    return this.plans.create(organizationId, user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Update vacation plan lines (DRAFT/REJECTED)" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceVacationPlanDto,
  ) {
    return this.plans.update(organizationId, id, user.sub, dto);
  }

  @Post(":id/submit")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "DRAFT/REJECTED → SUBMITTED" })
  submit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.plans.submit(organizationId, id, user.sub);
  }

  @Post(":id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_VACATION)
  @ApiOperation({
    summary: "SUBMITTED → APPROVED (+ WORKFORCE_VACATION_PLAN_APPROVED event)",
  })
  approve(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.plans.approve(organizationId, id, user.sub);
  }

  @Post(":id/reject")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_VACATION)
  @ApiOperation({ summary: "SUBMITTED → REJECTED" })
  reject(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: RejectWorkforceVacationPlanDto,
  ) {
    return this.plans.reject(organizationId, id, user.sub, dto);
  }
}
