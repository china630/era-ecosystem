/**
 * Industry ↔ Finance handoff HTTP client (Finance API :4100, prefix /api).
 */

export type FinanceHandoffOptions = {
  authHeader?: string | null;
};

export type FinanceRateQuoteResult = {
  ruleId: string;
  ruleName: string;
  zoneFrom: string;
  zoneTo: string;
  weightKg: number;
  amount: number;
  currency: string;
};

export type FinanceCodClearingResult = {
  settlementId: string;
  shipmentRef: string;
  totalCod: number;
  driverShare: number;
  hubShare: number;
  clientShare: number;
  status: string;
};

export type FinanceExternalPurchaseResult = {
  externalRef: string;
  purchase: Record<string, unknown>;
};

function financeApiBaseUrl(): string {
  const raw =
    process.env.ERA_FINANCE_API_INTERNAL_URL ??
    process.env.FINANCE_API_URL ??
    process.env.ERA_FINANCE_API_ORIGIN ??
    process.env.NEXT_PUBLIC_FINANCE_API_URL ??
    "http://127.0.0.1:4100";
  const base = raw.replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

function authHeaders(opts?: FinanceHandoffOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.authHeader) {
    headers.Authorization = opts.authHeader;
  }
  return headers;
}

async function postJson<T>(
  path: string,
  body: unknown,
  opts?: FinanceHandoffOptions,
): Promise<T> {
  const res = await fetch(`${financeApiBaseUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(opts),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Finance API POST ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(
  path: string,
  opts?: FinanceHandoffOptions,
): Promise<T> {
  const res = await fetch(`${financeApiBaseUrl()}${path}`, {
    method: "GET",
    headers: opts?.authHeader ? { Authorization: opts.authHeader } : {},
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Finance API GET ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return res.json() as Promise<T>;
}

export function financeStockCheck<T extends Record<string, unknown>>(
  body: T,
  opts?: FinanceHandoffOptions,
) {
  return postJson<unknown>("/inventory/stock-check", body, opts);
}

export function financeReplenishmentSuggestions(opts?: FinanceHandoffOptions) {
  return getJson<unknown>("/inventory/replenishment-suggestions", opts);
}

export function financeRateQuote<T extends Record<string, unknown>>(
  body: T,
  opts?: FinanceHandoffOptions,
) {
  return postJson<FinanceRateQuoteResult>("/logistics/rate-quote", body, opts);
}

export function financeCodClearing<T extends Record<string, unknown>>(
  body: T,
  opts?: FinanceHandoffOptions,
) {
  return postJson<FinanceCodClearingResult>("/logistics/cod-clearing", body, opts);
}

export function financeSupplierMatch<T extends Record<string, unknown>>(
  body: T,
  opts?: FinanceHandoffOptions,
) {
  return postJson<unknown>("/purchases/supplier-match", body, opts);
}

export function financeExternalPurchase<T extends Record<string, unknown>>(
  body: T,
  opts?: FinanceHandoffOptions,
) {
  return postJson<FinanceExternalPurchaseResult>(
    "/purchases/from-external",
    body,
    opts,
  );
}

export function financeEligibilityCheck<T extends Record<string, unknown>>(
  body: T,
  opts?: FinanceHandoffOptions,
) {
  return postJson<unknown>("/insurance/eligibility-check", body, opts);
}
