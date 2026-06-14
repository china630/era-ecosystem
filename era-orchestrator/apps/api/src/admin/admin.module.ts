import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionTrialModule } from "../subscription/subscription-trial.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AdminBillingController } from "./admin-billing.controller";
import { AdminBillingService } from "./admin-billing.service";
import { PublicPricingController } from "./public-pricing.controller";
import { PricingService } from "./pricing.service";
import { OrgOperatingModeController } from "./org-operating-mode.controller";
import { OrgOperatingModeService } from "./org-operating-mode.service";
import { OrgDepartmentsController } from "./org-departments.controller";
import { OrgDepartmentsService } from "./org-departments.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  imports: [PrismaModule, SystemConfigModule, SubscriptionTrialModule],
  controllers: [
    AdminBillingController,
    PublicPricingController,
    OrgOperatingModeController,
    OrgDepartmentsController,
  ],
  providers: [
    AdminBillingService,
    PricingService,
    OrgOperatingModeService,
    OrgDepartmentsService,
    PermissionsGuard,
  ],
  exports: [AdminBillingService, PricingService, OrgOperatingModeService, OrgDepartmentsService],
})
export class AdminModule {}
