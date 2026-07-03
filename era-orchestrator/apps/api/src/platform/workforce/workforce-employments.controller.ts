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
  CreateWorkforceEmploymentDto,
  ListWorkforceEmploymentsQueryDto,
} from "./dto/workforce-employment.dto";
import { TransferEmploymentDto } from "./dto/workforce-org.dto";
import { HireWorkforceEmploymentDto } from "./dto/workforce-provision.dto";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceOrgScopeService } from "./workforce-org-scope.service";
import { WorkforceProvisionService } from "./workforce-provision.service";

@ApiTags("platform-workforce-employments")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/employments")
@UseGuards(RolesGuard)
export class WorkforceEmploymentsController {
  constructor(
    private readonly employments: WorkforceEmploymentsService,
    private readonly orgScope: WorkforceOrgScopeService,
    private readonly provision: WorkforceProvisionService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "List workforce employments (CP)" })
  async list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query() query: ListWorkforceEmploymentsQueryDto,
  ) {
    const status =
      query.status === "ACTIVE" || query.status === "TERMINATED"
        ? query.status
        : undefined;
    const managedIds = await this.orgScope.resolveManagedOrgUnitIds(
      organizationId,
      user.sub,
      user.role ?? undefined,
    );
    const rows = await this.employments.list(organizationId, {
      status,
      orgUnitId: query.orgUnitId,
      subtree: query.subtree === "true" || query.subtree === "1",
      orgUnitIds: managedIds,
    });
    const personIds = rows.map((r) => r.globalPersonId);
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      personIds,
    );
    return { items: rows, persons };
  }

  @Post("hire")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Hire with satellite provision (CP master)" })
  hire(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: HireWorkforceEmploymentDto,
  ) {
    return this.provision.hire(organizationId, user.sub, dto);
  }

  @Get(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Workforce employment detail" })
  async getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.employments.getOne(organizationId, id);
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      [row.globalPersonId],
    );
    return { ...row, person: persons[row.globalPersonId] ?? null };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Hire person into workforce (MDM globalPersonId)" })
  async create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceEmploymentDto,
  ) {
    return this.employments.create(organizationId, user.sub, dto);
  }

  @Patch(":id/transfer")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Transfer employment to another org unit/position" })
  transfer(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: TransferEmploymentDto,
  ) {
    return this.employments.transfer(organizationId, id, user.sub, dto);
  }

  @Post(":id/terminate")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Terminate employment and revoke satellite access" })
  terminate(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.provision.terminate(organizationId, id, user.sub);
  }

  @Patch(":id/reprovision")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Re-emit STAFF_PROVISIONED for active bindings" })
  reprovision(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.provision.reprovision(organizationId, id, user.sub);
  }
}
