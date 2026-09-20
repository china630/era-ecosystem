import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceHoldingService } from "./workforce-holding.service";
import { WorkforceSecurityService } from "./workforce-security.service";

@ApiTags("platform-workforce-security")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/security")
@UseGuards(PermissionsGuard)
export class WorkforceSecurityController {
  constructor(
    private readonly security: WorkforceSecurityService,
    private readonly holdingHr: WorkforceHoldingService,
  ) {}

  @Get("overview")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SECURITY)
  @ApiOperation({ summary: "Security admin overview" })
  overview(@OrganizationId() organizationId: string) {
    return this.security.overview(organizationId);
  }

  @Get("bindings")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SECURITY)
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
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SECURITY)
  @ApiOperation({
    summary:
      "Workforce security audit log. Optional holdingId = union of visible HR orgs.",
  })
  async audit(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("action") action?: string,
    @Query("globalPersonId") globalPersonId?: string,
    @Query("cpEmploymentId") cpEmploymentId?: string,
    @Query("holdingId") holdingId?: string,
  ) {
    let organizationIds: string[] | undefined;
    const hid = holdingId?.trim();
    if (hid) {
      organizationIds = await this.holdingHr.resolveVisibleOrgIdsForAudit(
        user.sub,
        hid,
      );
    }
    return this.security.auditLog(
      organizationId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 50)),
      { action, globalPersonId, cpEmploymentId, organizationIds },
    );
  }
}
