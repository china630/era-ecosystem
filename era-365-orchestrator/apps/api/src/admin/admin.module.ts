import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AdminBillingController } from "./admin-billing.controller";
import { AdminBillingService } from "./admin-billing.service";
import { PublicPricingController } from "./public-pricing.controller";
import { PricingService } from "./pricing.service";

@Module({
  imports: [PrismaModule, SystemConfigModule, AuthModule],
  controllers: [AdminBillingController, PublicPricingController],
  providers: [AdminBillingService, PricingService],
  exports: [AdminBillingService, PricingService],
})
export class AdminModule {}
