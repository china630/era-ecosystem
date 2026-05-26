import { Injectable } from "@nestjs/common";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { resolveOrganizationUuid } from "../common/organization-id.util";
import { BadRequestException } from "@nestjs/common";

@Injectable()
export class PlatformEntitlementService {
  constructor(
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async assertPlatformModule(
    organizationId: string,
    moduleKey: string,
  ): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      throw new BadRequestException("Invalid organization id");
    }
    await this.subscriptionAccess.assertModuleAccess(orgId, moduleKey);
  }
}
