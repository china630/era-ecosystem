import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { SatelliteEndpointsController } from "../admin/satellite-endpoints.controller";
import { SatelliteOrgBindSyncController } from "../admin/satellite-org-bind-sync.controller";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";
import { SatelliteEndpointRegistryService } from "./satellite-endpoint-registry.service";
import { SatelliteEventSubscriberRegistry } from "./satellite-event-subscriber.registry";
import { SatelliteEventsController } from "./satellite-events.controller";
import { SatelliteEventsService } from "./satellite-events.service";
import { SatelliteFanoutWorker } from "./satellite-fanout.worker";
import { WorkforceModule } from "../workforce/workforce.module";

@Module({
  imports: [PrismaModule, SubscriptionModule, AuthModule, WorkforceModule],
  controllers: [
    SatelliteEventsController,
    SatelliteEndpointsController,
    SatelliteOrgBindSyncController,
  ],
  providers: [
    SatelliteEventsService,
    SatelliteEndpointRegistryService,
    SatelliteFanoutWorker,
    SatelliteEventSubscriberRegistry,
    SatelliteOrgBindSyncService,
    PermissionsGuard,
  ],
  exports: [
    SatelliteEventsService,
    SatelliteEndpointRegistryService,
    SatelliteFanoutWorker,
    SatelliteEventSubscriberRegistry,
    SatelliteOrgBindSyncService,
  ],
})
export class SatelliteEventsModule {}
