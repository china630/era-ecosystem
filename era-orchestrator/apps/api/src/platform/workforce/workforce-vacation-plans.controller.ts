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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
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
@UseGuards(RolesGuard)
export class WorkforceVacationPlansController {
  constructor(private readonly plans: WorkforceVacationPlansService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "List workforce vacation plans" })
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListWorkforceVacationPlansQueryDto,
  ) {
    return this.plans.list(organizationId, query);
  }

  @Get(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Vacation plan detail" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.plans.getOne(organizationId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Create vacation plan (DRAFT or SUBMITTED)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceVacationPlanDto,
  ) {
    return this.plans.create(organizationId, user.sub, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "DRAFT/REJECTED → SUBMITTED" })
  submit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.plans.submit(organizationId, id, user.sub);
  }

  @Post(":id/approve")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
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
