import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const DEFAULT_DASHBOARD = ["USD", "EUR", "GBP", "RUB", "TRY", "CNY"] as const;
const DEFAULT_CHECK = ["USD", "EUR"] as const;

function parseCodes(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw?.trim()) return [...fallback];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => String(x).trim().toUpperCase())
        .filter((c) => /^[A-Z]{3}$/.test(c));
    }
  } catch {
    /* comma-separated fallback */
  }
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c) => /^[A-Z]{3}$/.test(c));
}

@Injectable()
export class HubFxConfigService {
  constructor(private readonly config: ConfigService) {}

  getFxDashboardCurrencyCodes(): string[] {
    const codes = parseCodes(
      this.config.get<string>("DATA_HUB_FX_DASHBOARD_CODES"),
      DEFAULT_DASHBOARD,
    );
    return codes.length > 0 ? codes : [...DEFAULT_DASHBOARD];
  }

  getFxCbarCheckCurrencyCodes(): string[] {
    const codes = parseCodes(
      this.config.get<string>("DATA_HUB_FX_CBAR_CHECK_CODES"),
      DEFAULT_CHECK,
    );
    return codes.length > 0 ? codes : [...DEFAULT_CHECK];
  }
}
