import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import Redis from "ioredis";
import { IntegrationReliabilityService } from "../../integrations/integration-reliability.service";
import { DataMaskingService } from "../../privacy/data-masking.service";
import type {
  BankBalanceItem,
  BankingProviderInterface,
  BankStatementItem,
  PaymentDraftRequest,
  PaymentDraftResult,
  OrgBankCall,
} from "./banking-provider.interface";

type BirbankOAuthTokenResponse = {
  access_token?: string;
  token?: string;
  expires_in?: number;
  expiresIn?: number;
};

@Injectable()
export class BirbankAdapter implements BankingProviderInterface, OnModuleDestroy {
  private readonly logger = new Logger(BirbankAdapter.name);
  private readonly http: AxiosInstance;
  private readonly redis: Redis;
  private readonly baseUrl: string;
  private readonly tokenPath: string;
  private readonly accountsPath: string;
  private readonly statementsPath: string;
  private readonly paymentDraftsPath: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scope: string | null;
  private readonly audience: string | null;
  private readonly redisKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly reliability: IntegrationReliabilityService,
    private readonly dataMasking: DataMaskingService,
  ) {
    this.baseUrl = this.config.get<string>(
      "BIRBANK_API_BASE_URL",
      "https://api.birbank.business",
    );
    this.tokenPath = this.config.get<string>("BIRBANK_OAUTH_TOKEN_PATH", "/oauth/token");
    this.accountsPath = this.config.get<string>("BIRBANK_ACCOUNTS_PATH", "/accounts");
    this.statementsPath = this.config.get<string>(
      "BIRBANK_STATEMENTS_PATH",
      "/accounts/statements",
    );
    this.paymentDraftsPath = this.config.get<string>(
      "BIRBANK_PAYMENT_DRAFTS_PATH",
      "/payments/drafts",
    );
    this.clientId = this.config.get<string>("BIRBANK_CLIENT_ID", "");
    this.clientSecret = this.config.get<string>("BIRBANK_CLIENT_SECRET", "");
    this.scope = this.config.get<string>("BIRBANK_OAUTH_SCOPE") ?? null;
    this.audience = this.config.get<string>("BIRBANK_OAUTH_AUDIENCE") ?? null;
    this.redisKey = this.config.get<string>(
      "BIRBANK_OAUTH_TOKEN_CACHE_KEY",
      "banking:birbank:oauth:token",
    );

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 20_000,
    });

    const redisUrl = this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379");
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
  }

  /**
   * Birbank / Kapital Bank API references:
   * - https://api.birbank.business/products/7/1 (Corporate API v1)
   * - Open API Portal: https://api.birbank.business/how-to-use
   *
   * Endpoints are configurable by env:
   * - BIRBANK_OAUTH_TOKEN_PATH (default: /oauth/token)
   * - BIRBANK_ACCOUNTS_PATH (default: /accounts)
   * - BIRBANK_STATEMENTS_PATH (default: /accounts/statements)
   */
  async getBalances(creds?: OrgBankCall): Promise<BankBalanceItem[]> {
    const response = await this.authorizedRequest<unknown>(
      { method: "GET", url: this.accountsPath },
      true,
      creds,
    );
    return this.mapBalances(response.data);
  }

  async getStatements(from: string, to: string, creds?: OrgBankCall): Promise<BankStatementItem[]> {
    const response = await this.authorizedRequest<unknown>(
      { method: "GET", url: this.statementsPath, params: { from, to } },
      true,
      creds,
    );
    return this.mapStatements(response.data);
  }

  async sendPaymentDraft(payload: PaymentDraftRequest, creds?: OrgBankCall): Promise<PaymentDraftResult> {
    const idemKey =
      payload.reference?.trim() ||
      createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
    const response = await this.reliability.executeWithPolicies({
      provider: "birbank",
      operation: "payment_draft",
      writeIdempotencyKey: idemKey,
      request: () =>
        this.authorizedRequest<{
          id?: string | number;
          draftId?: string | number;
          status?: string;
        }>(
          {
            method: "POST",
            url: this.paymentDraftsPath,
            data: payload,
          },
          true,
          creds,
        ),
    });
    const draftId = String(response.data?.draftId ?? response.data?.id ?? "");
    const status = response.data?.status ?? "CREATED";
    return {
      draftId,
      status,
      providerPayload: response.data,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async authorizedRequest<T>(
    config: AxiosRequestConfig,
    retryOnTokenError = true,
    creds?: OrgBankCall,
  ): Promise<AxiosResponse<T>> {
    const token = await this.getAccessToken(creds);
    try {
      return await this.reliability.executeWithPolicies({
        provider: "birbank",
        operation: `http_${String(config.method ?? "GET").toUpperCase()}:${String(config.url ?? "")}`,
        request: () =>
          this.http.request<T>({
            ...config,
            headers: {
              ...(config.headers ?? {}),
              Authorization: `Bearer ${token}`,
            },
          }),
      });
    } catch (error) {
      const shouldRetry = retryOnTokenError && this.isInvalidTokenError(error);
      if (shouldRetry) {
        await this.redis.del(this.tokenCacheKey(creds));
        const freshToken = await this.getAccessToken(creds);
        return this.http.request<T>({
          ...config,
          headers: {
            ...(config.headers ?? {}),
            Authorization: `Bearer ${freshToken}`,
          },
        });
      }
      this.handleBirbankError(error);
      throw error;
    }
  }

  private tokenCacheKey(creds?: OrgBankCall): string {
    if (!creds?.clientId) return this.redisKey;
    const suffix = createHash("sha256").update(creds.clientId).digest("hex").slice(0, 12);
    return `${this.redisKey}:${suffix}`;
  }

  private async getAccessToken(creds?: OrgBankCall): Promise<string> {
    const cacheKey = this.tokenCacheKey(creds);
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const clientId = creds?.clientId ?? (creds ? "" : this.clientId);
    const clientSecret = creds?.secret ?? (creds ? "" : this.clientSecret);
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException(
        creds
          ? "Birbank credentials for this organization are missing on the platform"
          : "Birbank OAuth credentials are missing (BIRBANK_CLIENT_ID / BIRBANK_CLIENT_SECRET)",
      );
    }

    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    if (this.scope) body.set("scope", this.scope);
    if (this.audience) body.set("audience", this.audience);

    try {
      const response = await this.reliability.executeWithPolicies({
        provider: "birbank",
        operation: "oauth_token",
        request: () =>
          this.http.post<BirbankOAuthTokenResponse>(
            this.tokenPath,
            body.toString(),
            {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            },
          ),
      });
      const token = response.data?.access_token ?? response.data?.token;
      if (!token) {
        throw new UnauthorizedException("Birbank OAuth token is missing in response");
      }
      const rawTtl = response.data?.expires_in ?? response.data?.expiresIn ?? 300;
      const safeTtl = Math.max(30, Number(rawTtl) - 30);
      await this.redis.set(cacheKey, token, "EX", safeTtl);
      return token;
    } catch (error) {
      this.handleBirbankError(error);
      throw error;
    }
  }

  private isInvalidTokenError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    if (status === 401) return true;
    const body = error.response?.data;
    const text = typeof body === "string" ? body : JSON.stringify(body ?? {});
    return /invalid[_\s-]?token|token.*expired/i.test(text);
  }

  private handleBirbankError(error: unknown): never {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const status = error.response?.status;
    const body = error.response?.data;
    const text = typeof body === "string" ? body : JSON.stringify(body ?? {});

    if (status === 429 || /rate[_\s-]?limit|too many requests/i.test(text)) {
      throw new HttpException(
        "Birbank API rate limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (status === 401 || /invalid[_\s-]?token|token.*expired/i.test(text)) {
      throw new UnauthorizedException("Birbank API token is invalid or expired");
    }
    const safeBody = this.dataMasking.maskForLogSnippet(body, 400);
    this.logger.warn(`Birbank API error status=${status ?? "n/a"} body=${safeBody}`);
    throw error;
  }

  private mapBalances(payload: unknown): BankBalanceItem[] {
    const items = this.extractArray(payload, ["accounts", "items", "data", "accountList"]);
    return items.map((row, idx) => {
      const rec = this.asRecord(row);
      const accountId = this.pickString(rec, [
        "accountId",
        "id",
        "accountNo",
        "number",
        "accountNumber",
      ]);
      const iban = this.pickString(rec, ["iban", "accountIban", "accountIBAN"]);
      const currency = this.pickStringOr(rec, ["currencyCode", "currency", "ccy"], "AZN");
      const amount = this.pickAmount(rec, [
        "amount",
        "availableBalance",
        "balance",
        "currentBalance",
        "availableAmount",
      ]);
      return {
        accountId: accountId || `birbank-account-${idx + 1}`,
        iban: iban ?? null,
        currency,
        amount,
      };
    });
  }

  private mapStatements(payload: unknown): BankStatementItem[] {
    const items = this.extractArray(payload, [
      "transactions",
      "items",
      "data",
      "operations",
      "statementItems",
    ]);
    return items.map((row, idx) => {
      const rec = this.asRecord(row);
      const externalId = this.pickString(rec, [
        "transactionId",
        "id",
        "operationId",
        "reference",
      ]);
      const amount = this.pickAmount(rec, ["amount", "transactionAmount", "sum"]);
      const currency = this.pickStringOr(rec, ["currencyCode", "currency", "ccy"], "AZN");
      const date = this.pickStringOr(
        rec,
        ["transactionDate", "date", "operationDate", "createdAt"],
        new Date().toISOString(),
      );
      const description = this.pickString(
        rec,
        ["description", "details", "purpose", "transactionDescription"],
        null,
      );
      const counterpartyIban = this.pickString(rec, ["counterpartyIban", "beneficiaryIban", "iban"], null);
      const counterpartyName = this.pickString(rec, ["counterpartyName", "beneficiaryName", "name"], null);
      return {
        externalId: externalId || `birbank-tx-${idx + 1}`,
        amount,
        currency,
        date,
        description,
        counterpartyIban,
        counterpartyName,
      };
    });
  }

  private extractArray(payload: unknown, keys: string[]): unknown[] {
    if (Array.isArray(payload)) return payload;
    const root = this.asRecord(payload);
    for (const key of keys) {
      const value = root[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        const nested = this.asRecord(value);
        if (Array.isArray(nested.items)) return nested.items;
        if (Array.isArray(nested.data)) return nested.data;
      }
    }
    return [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private pickString(
    source: Record<string, unknown>,
    keys: string[],
    fallback: string | null = "",
  ): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
    return fallback;
  }

  private pickStringOr(
    source: Record<string, unknown>,
    keys: string[],
    fallback: string,
  ): string {
    return this.pickString(source, keys, fallback) ?? fallback;
  }

  private pickAmount(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
    }
    return "0";
  }
}

