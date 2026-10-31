import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { FxIngestService } from "./fx-ingest.service";

/**
 * CBAR publishes the day's XML around 10:00 Asia/Baku.
 * Poll from 09:30 every 30 minutes. syncTodayFromCbar skips HTTP once today's FINAL USD exists.
 */
@Injectable()
export class FxIngestCron {
  private readonly logger = new Logger(FxIngestCron.name);

  constructor(private readonly ingest: FxIngestService) {}

  @Cron("30 9 * * *", { timeZone: "Asia/Baku" })
  async atNineThirty(): Promise<void> {
    await this.runSafe();
  }

  @Cron("0,30 10-23 * * *", { timeZone: "Asia/Baku" })
  async everyHalfHourAfterTen(): Promise<void> {
    await this.runSafe();
  }

  private async runSafe(): Promise<void> {
    try {
      await this.ingest.syncTodayFromCbar();
    } catch (e) {
      this.logger.warn(
        `CBAR ingest cron: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
