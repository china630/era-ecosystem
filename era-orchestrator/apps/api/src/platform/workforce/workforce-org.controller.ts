import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  BootstrapWorkforceScopeDto,
  CreateOrgUnitDto,
  UpdateOrgUnitDto,
  UpsertCommercialLinkDto,
} from "./dto/workforce-org.dto";
import { WorkforceOrgUnitsService } from "./workforce-org-units.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("platform-workforce-org")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce")
@UseGuards(RolesGuard)
export class WorkforceOrgController {
  constructor(
    private readonly scope: WorkforceScopeService,
    private readonly orgUnits: WorkforceOrgUnitsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("scope")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Resolve workforce scope for commercial org" })
  getScope(@OrganizationId() organizationId: string) {
    return this.scope.resolveScopeForCommercialOrg(organizationId);
  }

  @Post("scope/bootstrap")
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: "Bootstrap workforce scope + root OrgUnit" })
  bootstrap(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: BootstrapWorkforceScopeDto,
  ) {
    return this.scope.bootstrap(organizationId, user.sub, dto.name);
  }

  @Get("org-units")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  listOrgUnits(
    @OrganizationId() organizationId: string,
    @Query("tree") tree?: string,
  ) {
    return this.orgUnits.list(organizationId, tree !== "1");
  }

  @Post("org-units")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  createOrgUnit(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateOrgUnitDto,
  ) {
    return this.orgUnits.create(organizationId, user.sub, dto);
  }

  @Patch("org-units/:id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  updateOrgUnit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateOrgUnitDto,
  ) {
    return this.orgUnits.update(organizationId, id, user.sub, dto);
  }

  @Post("org-units/:id/archive")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  archiveOrgUnit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.orgUnits.archive(organizationId, id, user.sub);
  }

  @Get("commercial-links/:organizationId")
  @Roles(UserRole.OWNER)
  getCommercialLink(@Param("organizationId") orgId: string) {
    return this.prisma.orgUnitCommercialLink.findUnique({
      where: { organizationId: orgId },
      include: { workforceScope: true, orgUnit: true },
    });
  }

  @Put("commercial-links/:organizationId")
  @Roles(UserRole.OWNER)
  upsertCommercialLink(
    @Param("organizationId") orgId: string,
    @Body() dto: UpsertCommercialLinkDto,
  ) {
    return this.prisma.orgUnitCommercialLink.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        workforceScopeId: dto.workforceScopeId,
        orgUnitId: dto.orgUnitId ?? null,
        linkMode: dto.linkMode ?? "SCOPE_ROOT",
      },
      update: {
        workforceScopeId: dto.workforceScopeId,
        orgUnitId: dto.orgUnitId ?? null,
        ...(dto.linkMode ? { linkMode: dto.linkMode } : {}),
      },
    });
  }
}
