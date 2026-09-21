import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessControlService } from "../access/access-control.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";

import { IntegrationReliabilityService } from "./integration-reliability.service";

@ApiTags("integrations")
@ApiBearerAuth("bearer")
@Controller("integrations")
@UseGuards(PermissionsGuard)
@Permissions(CP_PERMISSION.API_BILLING_MANAGE)
export class IntegrationsHealthController {
  constructor(
    private readonly access: AccessControlService,
    private readonly reliability: IntegrationReliabilityService,
  ) {}

  @Get("health")
  @ApiOperation({
    summary:
      "Integration health status for banking adapters, IBAN and tax providers (owner only)",
  })
  async health(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
  ) {
    await this.access.assertOwnerForBilling(user.userId, organizationId);
    const providers = await this.reliability.getProvidersHealthSnapshot([
      "pasha",
      "abb",
      "birbank",
      "iban",
      "tax",
    ]);
    return {
      organizationId,
      generatedAt: new Date().toISOString(),
      providers,
    };
  }
}

