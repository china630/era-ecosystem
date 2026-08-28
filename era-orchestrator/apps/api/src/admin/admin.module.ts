import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionTrialModule } from "../subscription/subscription-trial.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AdminBillingController } from "./admin-billing.controller";
import { AdminBillingService } from "./admin-billing.service";
import { AdminLandingController } from "./admin-landing.controller";
import { PublicPricingController } from "./public-pricing.controller";
import { PublicLandingController } from "./public-landing.controller";
import { PricingService } from "./pricing.service";
import { LandingMarketingService } from "./landing-marketing.service";
import { OrgOperatingModeController } from "./org-operating-mode.controller";
import { OrgOperatingModeService } from "./org-operating-mode.service";
import { OrgDepartmentsController } from "./org-departments.controller";
import { OrgDepartmentsService } from "./org-departments.service";
import { AdminOrganizationsController } from "./admin-organizations.controller";
import { AdminOrganizationsService } from "./admin-organizations.service";
import { ElektrawebBridgePolicyController } from "./elektraweb-bridge-policy.controller";
import { ElektrawebBridgePolicyService } from "./elektraweb-bridge-policy.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  imports: [PrismaModule, SystemConfigModule, SubscriptionTrialModule],
  controllers: [
    AdminBillingController,
    AdminLandingController,
    PublicPricingController,
    PublicLandingController,
    OrgOperatingModeController,
    OrgDepartmentsController,
    AdminOrganizationsController,
    ElektrawebBridgePolicyController,
  ],
  providers: [
    AdminBillingService,
    LandingMarketingService,
    PricingService,
    OrgOperatingModeService,
    OrgDepartmentsService,
    AdminOrganizationsService,
    ElektrawebBridgePolicyService,
    PermissionsGuard,
  ],
  exports: [
    AdminBillingService,
    LandingMarketingService,
    PricingService,
    OrgOperatingModeService,
    OrgDepartmentsService,
    AdminOrganizationsService,
    ElektrawebBridgePolicyService,
  ],
})
export class AdminModule {}
