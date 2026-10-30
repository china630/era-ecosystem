import { Global, Module } from "@nestjs/common";
import { AccessControlModule } from "../access/access-control.module";
import { AdminModule } from "../admin/admin.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { SubscriptionAccessService } from "./subscription-access.service";
import { SubscriptionController } from "./subscription.controller";
import { InternalSubscriptionController } from "./internal-subscription.controller";
import { SubscriptionGuard } from "./subscription.guard";
import { SubscriptionTrialModule } from "./subscription-trial.module";

/**
 * Do not import BillingModule here — Quota→Billing→Admin→SubscriptionTrial cycle
 * leaves Nest dead before /health (droplet outage 2026-10-28). Owner module-addon
 * notify uses ModuleRef for BillingSatelliteNotifyService.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    QuotaModule,
    AccessControlModule,
    AdminModule,
    SubscriptionTrialModule,
  ],
  controllers: [SubscriptionController, InternalSubscriptionController],
  providers: [SubscriptionAccessService, SubscriptionGuard],
  exports: [SubscriptionAccessService, SubscriptionGuard],
})
export class SubscriptionModule {}
