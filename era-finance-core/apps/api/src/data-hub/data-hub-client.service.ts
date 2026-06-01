import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@erafinance/database";

export type DataHubFxRate = {
  currencyCode: string;
  rate: number;
  rateDate: string;
};

export type DataHubTariff = {
  hsCode: string;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
};

/**
 * HTTP client for era-data-hub (internal era-network).
 * When ERA_DATA_HUB_ENABLED=false, callers fall back to local finance services.
 */
@Injectable()
export class DataHubClientService {
  private readonly logger = new Logger(DataHubClientService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (this.config.get<string>("ERA_DATA_HUB_ENABLED") ?? "false").toLowerCase() === "true";
  }

  private baseUrl(): string {
    return (this.config.get<string>("ERA_DATA_HUB_URL") ?? "http://127.0.0.1:4200").replace(
      /\/$/,
      "",
    );
  }

  private serviceToken(): string {
    return this.config.get<string>("DATA_HUB_SERVICE_TOKEN")?.trim() ?? "";
  }

  private async getJson<T>(path: string): Promise<T | null> {
    if (!this.isEnabled()) return null;
    const token = this.serviceToken();
    if (!token) {
      this.logger.warn("DATA_HUB_SERVICE_TOKEN missing; skip data-hub call");
      return null;
    }
    const url = `${this.baseUrl()}/registry/v1${path}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.warn(`data-hub ${path} HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (e) {
      this.logger.warn(
        `data-hub ${path} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  async getFxRates(date?: string, symbols = "USD,EUR"): Promise<DataHubFxRate[] | null> {
    const q = new URLSearchParams({ symbols });
    if (date) q.set("date", date);
    const body = await this.getJson<{ rates: DataHubFxRate[] }>(`/fx/rates?${q}`);
    return body?.rates ?? null;
  }

  async getCompanyByVoen(voen: string): Promise<Record<string, unknown> | null> {
    return this.getJson<Record<string, unknown>>(`/companies/${voen}?maskPii=false`);
  }

  async getTariff(hsCode: string, date: string): Promise<DataHubTariff | null> {
    const code = hsCode.replace(/\D/g, "");
    const q = new URLSearchParams({ date });
    const body = await this.getJson<{
      hsCode: string;
      dutyRatePercent: number;
      vatRatePercent: number;
      excisePercent: number;
    }>(`/hs/${code}/tariff?${q}`);
    if (!body) return null;
    return {
      hsCode: body.hsCode,
      dutyRatePercent: body.dutyRatePercent,
      vatRatePercent: body.vatRatePercent,
      excisePercent: body.excisePercent,
    };
  }

  async isWorkingDay(date: string, country = "az"): Promise<boolean | null> {
    const body = await this.getJson<{ isWorkingDay: boolean }>(
      `/calendar/${country}/is-working-day?date=${encodeURIComponent(date)}`,
    );
    return body?.isWorkingDay ?? null;
  }
}
