import { Module } from "@nestjs/common";
import { SatelliteEventsController } from "./satellite-events.controller";
import { SatelliteEventsService } from "./satellite-events.service";

@Module({
  controllers: [SatelliteEventsController],
  providers: [SatelliteEventsService],
})
export class SatelliteEventsModule {}
