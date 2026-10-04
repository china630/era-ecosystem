import { Module } from "@nestjs/common";
import { AccessControlModule } from "../access/access-control.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SatelliteEventsModule } from "../satellite-events/satellite-events.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { FnbEditionController } from "./fnb-edition.controller";
import { FnbEditionService } from "./fnb-edition.service";
import { KafeOnboardController } from "./kafe-onboard.controller";
import { KafeOnboardService } from "./kafe-onboard.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SubscriptionModule,
    SatelliteEventsModule,
    AccessControlModule,
  ],
  controllers: [KafeOnboardController, FnbEditionController],
  providers: [KafeOnboardService, FnbEditionService],
})
export class KafeModule {}
