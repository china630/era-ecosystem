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
  CreateWorkforceEmploymentDto,
  ListWorkforceEmploymentsQueryDto,
} from "./dto/workforce-employment.dto";
import { TransferEmploymentDto } from "./dto/workforce-org.dto";
import { HireWorkforceEmploymentDto } from "./dto/workforce-provision.dto";
import { ReprovisionEmploymentDto } from "./dto/workforce-reprovision.dto";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceOrgScopeService } from "./workforce-org-scope.service";
import { WorkforceProvisionService } from "./workforce-provision.service";

@ApiTags("platform-workforce-employments")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/employments")
@UseGuards(PermissionsGuard)
export class WorkforceEmploymentsController {
  constructor(
    private readonly employments: WorkforceEmploymentsService,
    private readonly orgScope: WorkforceOrgScopeService,
    private readonly provision: WorkforceProvisionService,
  ) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
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
      positionId: query.positionId,
      satelliteKey: query.satelliteKey,
      page: Math.max(1, Number(query.page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(query.pageSize) || 50)),
    });
    const personIds = rows.items.map((r) => r.globalPersonId);
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      personIds,
    );
    return { ...rows, persons };
  }

  @Post("hire")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HIRE)
  @ApiOperation({
    summary:
      "Hire (headcount always; satellite provision only when satelliteKeys set)",
  })
  hire(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: HireWorkforceEmploymentDto,
  ) {
    return this.provision.hire(organizationId, user.sub, dto);
  }

  @Get(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
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
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HIRE)
  @ApiOperation({ summary: "Hire person into workforce (MDM globalPersonId)" })
  async create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceEmploymentDto,
  ) {
    return this.employments.create(organizationId, user.sub, dto);
  }

  @Patch(":id/transfer")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HIRE)
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
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_TERMINATE)
  @ApiOperation({ summary: "Terminate employment and revoke satellite access" })
  terminate(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.provision.terminate(organizationId, id, user.sub);
  }

  @Patch(":id/reprovision")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_REPROVISION)
  @ApiOperation({
    summary:
      "Re-emit STAFF_PROVISIONED; optional satelliteKeys replaces per-person satellite access",
  })
  reprovision(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: ReprovisionEmploymentDto,
  ) {
    return this.provision.reprovision(organizationId, id, user.sub, {
      login: dto.login,
      pin: dto.pin,
      satelliteKeys: dto.satelliteKeys,
    });
  }
}
