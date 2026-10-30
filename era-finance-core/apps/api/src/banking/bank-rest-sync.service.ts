import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { getBankAdapter } from "./bank-adapters";
import type { BankAdapterKey } from "./bank-adapters";
import { BankingCredentialsService } from "./banking-credentials.service";
import type {
  BankingDirectRestBankConfig,
  BankingDirectRestSettings,
  RestFetchOutcome,
  RestPollResult,
} from "./bank-providers/bank-rest.types";

function asSettingsRecord(v: unknown): Record<string, unknown> {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

function asRestSettings(v: unknown): BankingDirectRestSettings {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    return { ...(v as BankingDirectRestSettings) };
  }
  return {};
}

type ProviderKey = BankAdapterKey;

const PROVIDERS: Array<{ key: ProviderKey; displayName: string }> = [
  { key: "pasha", displayName: "Pasha Bank" },
  { key: "abb", displayName: "ABB" },
  { key: "kapital", displayName: "Kapital Bank" },
];

@Injectable()
export class BankRestSyncService {
  private readonly logger = new Logger(BankRestSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credentials: BankingCredentialsService,
  ) {}

  /**
   * Опрос банков: URL и токен из settings (токен расшифровывается) или из env.
   */
  async fetchRestTransactions(organizationId: string): Promise<RestFetchOutcome> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const root = asSettingsRecord(org?.settings);
    const direct = asRestSettings(root.bankingDirect);

    const results: RestPollResult[] = [];
    const configWarnings: string[] = [];

    for (const p of PROVIDERS) {
      const bankCfg = direct[p.key] as BankingDirectRestBankConfig | undefined;
      if (bankCfg?.enabled !== true) {
        continue;
      }

      const url = bankCfg.url?.trim() ?? "";
      const storedRaw =
        typeof bankCfg.token === "string" ? bankCfg.token.trim() : "";
      const token =
        this.credentials.decryptFromStorage(storedRaw || undefined) ?? "";

      if (!url || !token) {
        configWarnings.push(
          `${p.displayName}: включён в настройках, но нет URL или токена`,
        );
        continue;
      }

      if (
        storedRaw &&
        this.credentials.looksEncrypted(storedRaw) &&
        !tokenFromDb
      ) {
        const msg = `${p.displayName}: не удалось расшифровать токен — проверьте BANKING_CREDENTIALS_ENCRYPTION_KEY`;
        this.logger.warn(`${msg} (org ${organizationId})`);
        results.push({
          bankName: p.displayName,
          transactions: [],
          skippedReason: msg,
        });
        continue;
      }

      try {
        const json = await this.fetchJson(url, token);
        const adapter = getBankAdapter(p.key);
        const transactions = adapter.mapResponse(json);
        results.push({ bankName: p.displayName, transactions });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `${p.displayName} REST sync failed for org ${organizationId}: ${msg}`,
        );
        results.push({
          bankName: p.displayName,
          transactions: [],
          skippedReason: msg,
        });
      }
    }

    return { results, configWarnings };
  }

  private async fetchJson(url: string, bearerToken: string): Promise<unknown> {
    const timeoutMs = Number(
      this.config.get<string>("BANK_SYNC_HTTP_TIMEOUT_MS", "45000"),
    );
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: "application/json",
        },
        signal: ac.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 401) {
          throw new Error(
            `401 Unauthorized — обновите токен. ${text.slice(0, 200)}`,
          );
        }
        if (res.status === 403) {
          throw new Error(
            `403 Forbidden — проверьте права доступа API. ${text.slice(0, 200)}`,
          );
        }
        throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      }
      return (await res.json()) as unknown;
    } finally {
      clearTimeout(t);
    }
  }
}
