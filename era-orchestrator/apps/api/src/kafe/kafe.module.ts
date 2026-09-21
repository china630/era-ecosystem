import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SatelliteEventsModule } from "../satellite-events/satellite-events.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { KafeOnboardController } from "./kafe-onboard.controller";
import { KafeOnboardService } from "./kafe-onboard.service";

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionModule, SatelliteEventsModule],
  controllers: [KafeOnboardController],
  providers: [KafeOnboardService],
})
export class KafeModule {}
