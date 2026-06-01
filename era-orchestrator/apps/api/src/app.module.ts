import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DisputeModule } from "./dispute/dispute.module";
import { EntitlementsModule } from "./entitlements/entitlements.module";
import { MembershipModule } from "./membership/membership.module";
import { OrganizationModule } from "./organization/organization.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SatelliteEventsModule } from "./satellite-events/satellite-events.module";
import { MdmModule } from "./mdm/mdm.module";
import { SystemConfigModule } from "./system-config/system-config.module";
import { AdminModule } from "./admin/admin.module";
import { BillingModule } from "./billing/billing.module";
import { SubscriptionModule } from "./subscription/subscription.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { EarlyAccessModule } from "./early-access/early-access.module";
import { QuotaModule } from "./quota/quota.module";
import { PlatformModule } from "./platform/platform.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 600 }],
    }),
    PrismaModule,
    SystemConfigModule,
    AuthModule,
    MembershipModule,
    OrganizationModule,
    DisputeModule,
    EntitlementsModule,
    SatelliteEventsModule,
    MdmModule,
    AdminModule,
    BillingModule,
    SubscriptionModule,
    ReferralsModule,
    EarlyAccessModule,
    QuotaModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
