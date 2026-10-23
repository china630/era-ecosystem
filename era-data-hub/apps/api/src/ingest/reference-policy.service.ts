import { Injectable } from "@nestjs/common";
import { ReferenceCatalogKind } from "@era/data-hub-database";
import { PrismaHubService } from "../prisma/prisma-hub.service";

export const REFERENCE_CATALOG_KINDS = [
  "FX",
  "BANKS",
  "COMPANIES",
  "HS",
  "GEO",
  "UOM",
  "CURRENCIES",
  "TAX_RATES",
  "CHART_OF_ACCOUNTS",
  "CALENDAR",
] as const;

export type ReferenceCatalogKindName = (typeof REFERENCE_CATALOG_KINDS)[number];

const FX_DASHBOARD_KEY = "fx.dashboard_currency_codes";
const FX_CHECK_KEY = "fx.cbar_check_currency_codes";

const DEFAULT_DASHBOARD = ["USD", "EUR", "GBP", "RUB", "TRY", "CNY", "JPY"];
const DEFAULT_CHECK = ["USD", "EUR"];

const DEFAULT_FETCH: Record<ReferenceCatalogKindName, boolean> = {
  FX: true,
  BANKS: false,
  COMPANIES: false,
  HS: false,
  GEO: false,
  UOM: false,
  CURRENCIES: false,
  TAX_RATES: false,
  CHART_OF_ACCOUNTS: false,
  CALENDAR: false,
};

function asKind(raw: string): ReferenceCatalogKindName | null {
  const upper = raw.trim().toUpperCase();
  return (REFERENCE_CATALOG_KINDS as readonly string[]).includes(upper)
    ? (upper as ReferenceCatalogKindName)
    : null;
}

function parseCodes(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const codes = value
    .map((item) => String(item).trim().toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code));
  return codes.length > 0 ? codes : [...fallback];
}

@Injectable()
export class ReferencePolicyService {
  constructor(private readonly hub: PrismaHubService) {}

  async listPolicies(): Promise<
    Array<{ catalogKind: ReferenceCatalogKindName; externalFetchEnabled: boolean }>
  > {
    const rows = await this.hub.referenceIngestPolicy.findMany();
    const byKind = new Map(rows.map((row) => [row.catalogKind, row.externalFetchEnabled]));
    return REFERENCE_CATALOG_KINDS.map((catalogKind) => ({
      catalogKind,
      externalFetchEnabled: byKind.get(catalogKind as ReferenceCatalogKind) ?? DEFAULT_FETCH[catalogKind],
    }));
  }

  async isExternalFetchEnabled(kind: ReferenceCatalogKindName): Promise<boolean> {
    const row = await this.hub.referenceIngestPolicy.findUnique({
      where: { catalogKind: kind as ReferenceCatalogKind },
    });
    if (!row) return DEFAULT_FETCH[kind];
    return row.externalFetchEnabled;
  }

  async getFxDashboardCurrencyCodes(): Promise<string[]> {
    return parseCodes(await this.readSetting(FX_DASHBOARD_KEY), DEFAULT_DASHBOARD);
  }

  async getFxCbarCheckCurrencyCodes(): Promise<string[]> {
    return parseCodes(await this.readSetting(FX_CHECK_KEY), DEFAULT_CHECK);
  }

  async save(input: {
    policies?: Array<{ catalogKind: string; externalFetchEnabled: boolean }>;
    fxDashboardCurrencyCodes?: string[];
    fxCbarCheckCurrencyCodes?: string[];
  }): Promise<{
    policies: Array<{ catalogKind: ReferenceCatalogKindName; externalFetchEnabled: boolean }>;
    fxDashboardCurrencyCodes: string[];
    fxCbarCheckCurrencyCodes: string[];
  }> {
    if (input.policies) {
      for (const row of input.policies) {
        const kind = asKind(row.catalogKind);
        if (!kind) continue;
        await this.hub.referenceIngestPolicy.upsert({
          where: { catalogKind: kind as ReferenceCatalogKind },
          create: {
            catalogKind: kind as ReferenceCatalogKind,
            externalFetchEnabled: Boolean(row.externalFetchEnabled),
          },
          update: { externalFetchEnabled: Boolean(row.externalFetchEnabled) },
        });
      }
    }
    if (input.fxDashboardCurrencyCodes) {
      await this.writeSetting(
        FX_DASHBOARD_KEY,
        parseCodes(input.fxDashboardCurrencyCodes, DEFAULT_DASHBOARD),
      );
    }
    if (input.fxCbarCheckCurrencyCodes) {
      await this.writeSetting(
        FX_CHECK_KEY,
        parseCodes(input.fxCbarCheckCurrencyCodes, DEFAULT_CHECK),
      );
    }
    return {
      policies: await this.listPolicies(),
      fxDashboardCurrencyCodes: await this.getFxDashboardCurrencyCodes(),
      fxCbarCheckCurrencyCodes: await this.getFxCbarCheckCurrencyCodes(),
    };
  }

  private async readSetting(key: string): Promise<unknown> {
    const row = await this.hub.hubPlatformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async writeSetting(key: string, value: string[]): Promise<void> {
    await this.hub.hubPlatformSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
