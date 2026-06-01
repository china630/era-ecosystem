import { Body, Controller, Headers, Post } from "@nestjs/common";
import { SatelliteEventsService } from "./satellite-events.service";

@Controller("api/v1/satellite-events")
export class SatelliteEventsController {
  constructor(private readonly events: SatelliteEventsService) {}

  @Post()
  ingest(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.events.assertServiceToken(authorization);
    return this.events.enqueue(body);
  }
}
