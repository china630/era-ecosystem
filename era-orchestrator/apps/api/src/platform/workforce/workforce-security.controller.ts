import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { WorkforceSecurityService } from "./workforce-security.service";

@ApiTags("platform-workforce-security")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/security")
@UseGuards(RolesGuard)
export class WorkforceSecurityController {
  constructor(private readonly security: WorkforceSecurityService) {}

  @Get("overview")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Security admin overview" })
  overview(@OrganizationId() organizationId: string) {
    return this.security.overview(organizationId);
  }

  @Get("bindings")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Paginated role bindings list" })
  bindings(
    @OrganizationId() organizationId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("orgUnitId") orgUnitId?: string,
    @Query("positionId") positionId?: string,
    @Query("satelliteKey") satelliteKey?: string,
    @Query("role") role?: string,
    @Query("provisionState") provisionState?: string,
  ) {
    return this.security.listBindings(
      organizationId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 50)),
      { search, orgUnitId, positionId, satelliteKey, role, provisionState },
    );
  }

  @Get("audit")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Workforce security audit log" })
  audit(
    @OrganizationId() organizationId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("action") action?: string,
    @Query("globalPersonId") globalPersonId?: string,
    @Query("cpEmploymentId") cpEmploymentId?: string,
  ) {
    return this.security.auditLog(
      organizationId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 50)),
      { action, globalPersonId, cpEmploymentId },
    );
  }
}
