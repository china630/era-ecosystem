import { Module } from "@nestjs/common";
import { SubscriptionModule } from "../subscription/subscription.module";
import { PlatformEntitlementService } from "./platform-entitlement.service";

@Module({
  imports: [SubscriptionModule],
  providers: [PlatformEntitlementService],
  exports: [PlatformEntitlementService],
})
export class PlatformSharedModule {}
