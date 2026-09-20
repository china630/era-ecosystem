import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrganizationId } from "../../common/org-id.decorator";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceSeatService } from "./workforce-seat.service";

@ApiTags("platform-workforce-seats")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/seats")
@UseGuards(PermissionsGuard)
export class WorkforceSeatsController {
  constructor(
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly seats: WorkforceSeatService,
  ) {}

  @Get("usage")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SEATS)
  @ApiOperation({ summary: "Workforce seat usage for Security Admin" })
  async usage(@OrganizationId() organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    return this.seats.getSeatUsage(link.workforceScopeId, organizationId);
  }
}
