import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { CbarExternalFetchDisabledError, formatBakuDateDdMmYyyy } from "./cbar-errors";
import type { FxDashboardRateRow } from "./fx-dashboard.types";

/**
 * Hub read-through for CBAR official rates (era-data-hub SoR).
 * Local ingest / CbarOfficialRate table removed in Data-Hub Phase 2.
 */
@Injectable()
export class CbarRateSyncService {
  private readonly logger = new Logger(CbarRateSyncService.name);

  constructor(
    private readonly systemConfig: SystemConfigService,
    private readonly dataHub: DataHubClientService,
  ) {}

  /**
   * AZN per 1 unit of currency from data-hub (FINAL / official rates).
   */
  async getFinalOfficialAznPerUnit(
    currencyCode: string,
    date: Date,
  ): Promise<number> {
    const upper = currencyCode.trim().toUpperCase();
    if (upper === "AZN" || upper === "AZM") {
      return 1;
    }
    if (!this.dataHub.isEnabled()) {
      throw new CbarExternalFetchDisabledError(
        "ERA_DATA_HUB_ENABLED=false — CBAR rates require era-data-hub",
      );
    }
    const dateKey = this.dataHub.isoDateBaku(date);
    const remote = await this.dataHub.getFxRates(dateKey, upper);
    const hit = remote?.find((r) => r.currencyCode === upper);
    if (hit?.rate != null && Number.isFinite(hit.rate)) {
      return hit.rate;
    }
    throw new BadRequestException(
      `CBAR: no official rate for ${upper} on ${dateKey} (data-hub)`,
    );
  }

  /**
   * Dashboard rates from data-hub only (no live CBAR HTTP, no local table).
   */
  async resolveDashboardRates(now: Date): Promise<{
    rates: FxDashboardRateRow[];
    isFallback: boolean;
  }> {
    const codes = await this.systemConfig.getFxDashboardCurrencyCodes();
    const todayKey = formatBakuDateDdMmYyyy(now);
    const hubDateKey = this.dataHub.isoDateBaku(now);

    if (!this.dataHub.isEnabled()) {
      this.logger.debug("FX dashboard: data-hub disabled");
      return {
        rates: codes.map((code) => ({
          currencyCode: code,
          rate: null,
          value: null,
          nominal: null,
          rateDateBaku: null,
          isFallback: true,
          isUnavailable: true,
        })),
        isFallback: true,
      };
    }

    const remote = await this.dataHub.getFxRates(hubDateKey, codes.join(","));
    if (!remote?.length) {
      return {
        rates: codes.map((code) => ({
          currencyCode: code,
          rate: null,
          value: null,
          nominal: null,
          rateDateBaku: null,
          isFallback: true,
          isUnavailable: true,
        })),
        isFallback: true,
      };
    }

    const byCode = new Map(remote.map((r) => [r.currencyCode, r]));
    let anyFallback = false;
    const rates: FxDashboardRateRow[] = codes.map((code) => {
      const hit = byCode.get(code);
      if (hit) {
        const rateDateBaku = hit.rateDate
          ? formatBakuDateDdMmYyyy(new Date(`${hit.rateDate}T12:00:00.000Z`))
          : todayKey;
        const isFallback = rateDateBaku !== todayKey;
        if (isFallback) anyFallback = true;
        return {
          currencyCode: code,
          rate: hit.rate,
          value: hit.rate,
          nominal: 1,
          rateDateBaku,
          isFallback,
          isUnavailable: false,
        };
      }
      anyFallback = true;
      return {
        currencyCode: code,
        rate: null,
        value: null,
        nominal: null,
        rateDateBaku: null,
        isFallback: true,
        isUnavailable: true,
      };
    });

    return { rates, isFallback: anyFallback };
  }
}
