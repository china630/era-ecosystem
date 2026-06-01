import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { FxIngestService } from "./fx-ingest.service";

/**
 * После 10:00 по Баку ЦБА обновляет XML; повторные запросы переводят PRELIMINARY → FINAL при смене Value.
 */
@Injectable()
export class FxIngestCron {
  private readonly logger = new Logger(FxIngestCron.name);

  constructor(private readonly ingest: FxIngestService) {}

  @Cron("5 6 * * *", { timeZone: "Asia/Baku" })
  async earlyMorning(): Promise<void> {
    await this.runSafe();
  }

  @Cron("5 10 * * *", { timeZone: "Asia/Baku" })
  async afterCbarOpen(): Promise<void> {
    await this.runSafe();
  }

  @Cron("0 12 * * *", { timeZone: "Asia/Baku" })
  async noon(): Promise<void> {
    await this.runSafe();
  }

  @Cron("0 16 * * *", { timeZone: "Asia/Baku" })
  async afternoon(): Promise<void> {
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
