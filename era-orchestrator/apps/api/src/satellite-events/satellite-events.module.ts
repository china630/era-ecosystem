import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { SatelliteEndpointsController } from "../admin/satellite-endpoints.controller";
import { SatelliteEndpointRegistryService } from "./satellite-endpoint-registry.service";
import { SatelliteEventsController } from "./satellite-events.controller";
import { SatelliteEventsService } from "./satellite-events.service";
import { SatelliteFanoutWorker } from "./satellite-fanout.worker";

@Module({
  imports: [PrismaModule, SubscriptionModule, AuthModule],
  controllers: [SatelliteEventsController, SatelliteEndpointsController],
  providers: [
    SatelliteEventsService,
    SatelliteEndpointRegistryService,
    SatelliteFanoutWorker,
    PermissionsGuard,
  ],
  exports: [SatelliteEndpointRegistryService, SatelliteFanoutWorker],
})
export class SatelliteEventsModule {}
