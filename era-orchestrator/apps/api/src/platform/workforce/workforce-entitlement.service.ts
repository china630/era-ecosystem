import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  TariffTier,
  workforceFeatureAllowed,
  workforceUpgradeSlug,
  type WorkforceFeature,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionAccessService } from "../../subscription/subscription-access.service";

const WORKFORCE_MODULE = "platform_workforce";

@Injectable()
export class WorkforceEntitlementService {
  constructor(
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async assertWorkforceHub(organizationId: string): Promise<void> {
    if (await this.subscriptionAccess.hasModule(organizationId, WORKFORCE_MODULE)) {
      return;
    }
    throw new ForbiddenException({
      code: "PLATFORM_WORKFORCE_REQUIRED",
      message: "Workforce hub is not entitled for this organization.",
    });
  }

  async hasWorkforceHub(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(organizationId, WORKFORCE_MODULE);
  }

  async assertWorkforceFeature(
    organizationId: string,
    feature: WorkforceFeature,
  ): Promise<void> {
    await this.assertWorkforceHub(organizationId);
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { currentTier: true, activeModules: true },
    });
    if (sub?.currentTier === TariffTier.TIER_3) return;
    const modules = sub?.activeModules ?? [];
    if (workforceFeatureAllowed(modules, feature)) return;
    throw new ForbiddenException({
      code: "WORKFORCE_PACKAGE_REQUIRED",
      message: "This Workforce screen is not included in the current package.",
      requiredPackage: workforceUpgradeSlug(feature),
      feature,
    });
  }
}
