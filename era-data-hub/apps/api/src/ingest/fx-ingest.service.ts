import { Injectable, Logger } from "@nestjs/common";
import { CbarRateSyncService } from "./cbar-rate-sync.service";
import { ReferencePolicyService } from "./reference-policy.service";

/**
 * CBAR sync into era_data_hub. Runs only when the FX external-fetch switch is on.
 */
@Injectable()
export class FxIngestService {
  private readonly logger = new Logger(FxIngestService.name);

  constructor(
    private readonly cbarSync: CbarRateSyncService,
    private readonly policy: ReferencePolicyService,
  ) {}

  async syncTodayFromCbar(): Promise<void> {
    if (!(await this.policy.isExternalFetchEnabled("FX"))) {
      this.logger.debug("FxIngestService: skipped (FX external fetch disabled)");
      return;
    }
    await this.cbarSync.syncTodayFromCbar();
  }
}
