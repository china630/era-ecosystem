import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceSeatService } from "./workforce-seat.service";

@ApiTags("platform-workforce-seats")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/seats")
@UseGuards(RolesGuard)
export class WorkforceSeatsController {
  constructor(
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly seats: WorkforceSeatService,
  ) {}

  @Get("usage")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Workforce seat usage for Security Admin" })
  async usage(@OrganizationId() organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    return this.seats.getSeatUsage(link.workforceScopeId, organizationId);
  }
}
