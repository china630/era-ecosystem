import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AdminBillingController } from "./admin-billing.controller";
import { AdminBillingService } from "./admin-billing.service";
import { PublicPricingController } from "./public-pricing.controller";
import { PricingService } from "./pricing.service";
import { OrgOperatingModeController } from "./org-operating-mode.controller";
import { OrgOperatingModeService } from "./org-operating-mode.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  imports: [PrismaModule, SystemConfigModule, AuthModule],
  controllers: [
    AdminBillingController,
    PublicPricingController,
    OrgOperatingModeController,
  ],
  providers: [
    AdminBillingService,
    PricingService,
    OrgOperatingModeService,
    PermissionsGuard,
  ],
  exports: [AdminBillingService, PricingService, OrgOperatingModeService],
})
export class AdminModule {}
