import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { HEALTH_CHECK_PAYLOAD, healthCheckWithDiagnostics } from "./common/health-payload";
import { Public } from "./auth/decorators/public.decorator";
import { CbarRateSyncService } from "./fx/cbar-rate-sync.service";
import { CbarExternalFetchDisabledError } from "./fx/cbar-errors";

@Controller()
export class AppController {
  constructor(private readonly rateSync: CbarRateSyncService) {}

  @Public()
  @SkipThrottle()
  @Get("health")
  health() {
    return healthCheckWithDiagnostics();
  }

  /**
   * Diagnostic FX sample via data-hub (legacy live CBAR HTTP removed in Phase 2).
   */
  @Public()
  @Get("fx/cbar/sample")
  async cbarSample() {
    try {
      const rate = await this.rateSync.getFinalOfficialAznPerUnit("USD", new Date());
      return { ok: true, latestUsd: { currencyCode: "USD", rate } };
    } catch (e) {
      if (e instanceof CbarExternalFetchDisabledError) {
        return { mock: true, message: e.message };
      }
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: message,
        path: "/api/fx/cbar/sample",
        hint: "FX rates come from era-data-hub (ERA_DATA_HUB_ENABLED). Use GET /api/fx/rates with JWT for the dashboard.",
      };
    }
  }
}
