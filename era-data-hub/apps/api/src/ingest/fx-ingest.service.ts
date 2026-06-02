import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CbarRateSyncService } from "./cbar-rate-sync.service";

/**
 * Phase 1: CBAR sync into era_data_hub (hub SoR).
 * Phase 0: ingest disabled when ERA_DATA_HUB_DATA_SOURCE=finance_ro.
 */
@Injectable()
export class FxIngestService {
  private readonly logger = new Logger(FxIngestService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cbarSync: CbarRateSyncService,
  ) {}

  isIngestEnabled(): boolean {
    const source = (this.config.get<string>("ERA_DATA_HUB_DATA_SOURCE") ?? "finance_ro")
      .trim()
      .toLowerCase();
    return source === "hub";
  }

  async syncTodayFromCbar(): Promise<void> {
    if (!this.isIngestEnabled()) {
      this.logger.debug("FxIngestService: skipped (ERA_DATA_HUB_DATA_SOURCE != hub)");
      return;
    }
    await this.cbarSync.syncTodayFromCbar();
  }
}
