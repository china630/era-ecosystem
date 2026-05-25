import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DisputeModule } from "./dispute/dispute.module";
import { EntitlementsModule } from "./entitlements/entitlements.module";
import { MembershipModule } from "./membership/membership.module";
import { OrganizationModule } from "./organization/organization.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SatelliteEventsModule } from "./satellite-events/satellite-events.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MembershipModule,
    OrganizationModule,
    DisputeModule,
    EntitlementsModule,
    SatelliteEventsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
