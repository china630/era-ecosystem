export type TradeCreditFacilitySnapshot = {
  creditLimit: number;
  available: number;
  stopList: boolean;
  source: string;
};

/**
 * `off` — Finance returned 402 or FINANCE_API_URL unset (stub path OK).
 * `on` — facility endpoint OK; on-account must consume grant.
 * `unknown` — Finance unreachable / non-402 error → fail-closed on confirm.
 */
export type TradeCreditSkuProbe = {
  status: "off" | "on" | "unknown";
  /** Alias: true only when status === "on". */
  skuEnabled: boolean;
  facility: TradeCreditFacilitySnapshot | null;
  error?: string;
};

type RequestCache = {
  skuByCounterparty: Map<string, TradeCreditSkuProbe>;
};

export function createTradeCreditRequestCache(): RequestCache {
  return { skuByCounterparty: new Map() };
}

function financeBaseUrl(): string | null {
  const base = process.env.FINANCE_API_URL?.replace(/\/$/, "");
  return base || null;
}

function serviceAuthHeader(userAuthHeader: string | null): string | null {
  const token =
    process.env.FINANCE_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.FINANCE_API_TOKEN?.trim() ||
    null;
  if (token) return `Bearer ${token}`;
  return userAuthHeader;
}

function cacheProbe(
  cache: RequestCache | undefined,
  counterpartyId: string,
  probe: TradeCreditSkuProbe,
): TradeCreditSkuProbe {
  cache?.skuByCounterparty.set(counterpartyId, probe);
  return probe;
}

/**
 * Probe Finance trade-credit facility (residual-only; never A–D fields).
 * Prefer internal `/internal/v1/trade-credit/facility` when organizationId known.
 * 402 → SKU off. Unreachable / other errors → unknown (confirm must fail-closed).
 */
export async function probeTradeCreditSku(
  counterpartyId: string,
  authHeader: string | null,
  cache?: RequestCache,
  organizationId?: string | null,
): Promise<TradeCreditSkuProbe> {
  const hit = cache?.skuByCounterparty.get(counterpartyId);
  if (hit) return hit;

  const base = financeBaseUrl();
  if (!base) {
    return cacheProbe(cache, counterpartyId, {
      status: "off",
      skuEnabled: false,
      facility: null,
    });
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const auth = serviceAuthHeader(authHeader) ?? authHeader;
  if (auth) headers.Authorization = auth;

  const org = organizationId?.trim();
  const url =
    org && auth
      ? `${base}/internal/v1/trade-credit/facility?organizationId=${encodeURIComponent(org)}&counterpartyId=${encodeURIComponent(counterpartyId)}`
      : `${base}/counterparties/${encodeURIComponent(counterpartyId)}/trade-credit`;

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  }).catch(() => null);

  if (!res) {
    return cacheProbe(cache, counterpartyId, {
      status: "unknown",
      skuEnabled: false,
      facility: null,
      error: "Finance trade-credit probe unreachable",
    });
  }

  if (res.status === 402) {
    return cacheProbe(cache, counterpartyId, {
      status: "off",
      skuEnabled: false,
      facility: null,
    });
  }

  if (!res.ok) {
    return cacheProbe(cache, counterpartyId, {
      status: "unknown",
      skuEnabled: false,
      facility: null,
      error: `Finance trade-credit probe failed (${res.status})`,
    });
  }

  const data = (await res.json()) as {
    creditLimit?: number | string;
    available?: number | string;
    stopList?: boolean;
    policyGroup?: unknown;
  };
  // Defense in depth: never propagate policy fields even if staff URL was used
  const creditLimit = Number(data.creditLimit ?? 0);
  const available = Number(data.available ?? 0);
  return cacheProbe(cache, counterpartyId, {
    status: "on",
    skuEnabled: true,
    facility: {
      creditLimit: Number.isFinite(creditLimit) ? creditLimit : 0,
      available: Number.isFinite(available) ? available : 0,
      stopList: Boolean(data.stopList),
      source: org ? "finance_trade_credit_internal" : "finance_trade_credit",
    },
  });
}

/** Legacy counterparty creditLimit read (stub path when SKU off). */
async function readCreditFromFinance(
  counterpartyId: string,
  authHeader: string | null,
): Promise<{ creditLimit: number; source: string } | null> {
  const base = financeBaseUrl();
  if (!base) return null;

  const res = await fetch(`${base}/counterparties/${counterpartyId}`, {
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    cache: "no-store",
  }).catch(() => null);

  if (!res?.ok) return null;
  const data = (await res.json()) as {
    creditLimit?: number | string | null;
    global?: { creditLimit?: number | string | null };
  };
  const raw = data.creditLimit ?? data.global?.creditLimit;
  if (raw == null || raw === "") return null;
  const creditLimit = Number(raw);
  if (!Number.isFinite(creditLimit)) return null;
  return { creditLimit, source: "finance_api" };
}

function readCreditLimitStub(counterpartyId: string) {
  const defaultLimit = Number(process.env.WHOLESALE_CREDIT_LIMIT_STUB ?? "10000");
  const overridesRaw = process.env.WHOLESALE_CREDIT_LIMIT_OVERRIDES;
  if (overridesRaw) {
    try {
      const overrides = JSON.parse(overridesRaw) as Record<string, number>;
      if (overrides[counterpartyId] != null) {
        return overrides[counterpartyId];
      }
    } catch {
      // fall through to default
    }
  }
  return defaultLimit;
}

export type ConsumeGrantResult =
  | { ok: true; grantId: string }
  | { ok: false; status: number; error: string };

export async function consumeTradeCreditGrant(params: {
  organizationId: string;
  counterpartyId: string;
  code: string;
  amount: number;
  sourceEntityType: string;
  sourceEntityId: string;
  authHeader?: string | null;
}): Promise<ConsumeGrantResult> {
  const base = financeBaseUrl();
  if (!base) {
    return { ok: false, status: 503, error: "FINANCE_API_URL is not configured" };
  }

  const auth = serviceAuthHeader(params.authHeader ?? null);
  if (!auth) {
    return {
      ok: false,
      status: 401,
      error: "Finance service token is not configured",
    };
  }

  const res = await fetch(`${base}/internal/v1/trade-credit/grants/consume`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      organizationId: params.organizationId,
      counterpartyId: params.counterpartyId,
      code: params.code,
      amount: params.amount,
      sourceEntityType: params.sourceEntityType,
      sourceEntityId: params.sourceEntityId,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) {
    return { ok: false, status: 503, error: "Finance consume unreachable" };
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      message?: string;
      error?: string;
      code?: string;
    } | null;
    return {
      ok: false,
      status: res.status,
      error:
        payload?.message ??
        payload?.error ??
        payload?.code ??
        `Finance consume failed (${res.status})`,
    };
  }

  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    return { ok: false, status: 502, error: "Finance consume returned no grant id" };
  }
  return { ok: true, grantId: body.id };
}

export { readCreditFromFinance, readCreditLimitStub };
