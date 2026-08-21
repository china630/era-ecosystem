import { forwardRef, Global, Module } from "@nestjs/common";
import { AccessControlModule } from "../access/access-control.module";
import { AdminModule } from "../admin/admin.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { SubscriptionAccessService } from "./subscription-access.service";
import { SubscriptionGuard } from "./subscription.guard";
import { CronModuleGateService } from "./cron-module-gate.service";

@Global()
@Module({
  imports: [
    PrismaModule,
    QuotaModule,
    AccessControlModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [],
  providers: [SubscriptionAccessService, SubscriptionGuard, CronModuleGateService],
  exports: [SubscriptionAccessService, SubscriptionGuard, CronModuleGateService],
})
export class SubscriptionModule {}
