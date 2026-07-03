import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { isSatelliteWorkforceTimesheetBatchImported } from "@era/contracts";
import { SatelliteEventSubscriberRegistry } from "../../satellite-events/satellite-event-subscriber.registry";
import { WorkforceTimesheetsService } from "./workforce-timesheets.service";

@Injectable()
export class WorkforceTimesheetSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(WorkforceTimesheetSubscriberService.name);

  constructor(
    private readonly registry: SatelliteEventSubscriberRegistry,
    private readonly timesheets: WorkforceTimesheetsService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      key: "workforce_timesheet_batch_imported",
      matches: (event) => isSatelliteWorkforceTimesheetBatchImported(event),
      handle: async (event) => {
        const result = await this.timesheets.handleBatchImported(event);
        this.logger.log(
          `WORKFORCE_TIMESHEET_BATCH_IMPORTED created=${result.created}`,
        );
      },
    });
  }
}
