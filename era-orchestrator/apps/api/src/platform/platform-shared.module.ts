import { Module } from "@nestjs/common";
import { SubscriptionModule } from "../subscription/subscription.module";
import { PlatformEntitlementService } from "./platform-entitlement.service";
import { PlatformAuditService } from "./platform-audit.service";
import { PlatformIdempotencyService } from "./platform-idempotency.service";

@Module({
  imports: [SubscriptionModule],
  providers: [
    PlatformEntitlementService,
    PlatformAuditService,
    PlatformIdempotencyService,
  ],
  exports: [
    PlatformEntitlementService,
    PlatformAuditService,
    PlatformIdempotencyService,
  ],
})
export class PlatformSharedModule {}
