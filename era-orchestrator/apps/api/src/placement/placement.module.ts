import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SatelliteEventsModule } from "../satellite-events/satellite-events.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PlacementJobService } from "./placement-job.service";
import { PlacementJobController } from "./placement-job.controller";
import { PlacementAgentController } from "./placement-agent.controller";

@Module({
  imports: [PrismaModule, SatelliteEventsModule],
  controllers: [PlacementJobController, PlacementAgentController],
  providers: [PlacementJobService, PermissionsGuard],
  exports: [PlacementJobService],
})
export class PlacementModule {}
