/**
 * ERA Data Hub FX rates — read-only client for CBAR official rates.
 * Industry satellites should use finance handoffs for accounting FX; this client is for
 * finance/bank-core and display-only paths when service token is available.
 */

import type {
  FxConvertResult,
  FxRatePoint,
  FxRatesRangeResponse,
  FxRatesResponse,
} from "@era/contracts";

export type FxRateClientOptions = {
  dataHubUrl?: string;
  serviceToken?: string;
  enabled?: boolean;
};

type CacheEntry<T> = { at: number; value: T };

const SPOT_TTL_MS = 5 * 60 * 1000;
const DATE_TTL_MS = 24 * 60 * 60 * 1000;

const spotCache = new Map<string, CacheEntry<FxRatesResponse>>();
const dateCache = new Map<string, CacheEntry<FxRatesResponse>>();

function hubEnabled(opts?: FxRateClientOptions): boolean {
  if (opts?.enabled === false) return false;
  const env = process.env.ERA_DATA_HUB_ENABLED;
  if (env != null && env.toLowerCase() === "false") return false;
  return true;
}

function baseUrl(opts?: FxRateClientOptions): string {
  return (
    opts?.dataHubUrl ??
    process.env.ERA_DATA_HUB_URL ??
    "http://127.0.0.1:4200"
  ).replace(/\/$/, "");
}

function serviceToken(opts?: FxRateClientOptions): string | undefined {
  return (
    opts?.serviceToken ??
    process.env.DATA_HUB_SERVICE_TOKEN ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN
  )?.trim();
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function getJson<T>(
  path: string,
  opts?: FxRateClientOptions,
): Promise<T | null> {
  if (!hubEnabled(opts)) return null;
  const token = serviceToken(opts);
  if (!token) return null;
  const url = `${baseUrl(opts)}/registry/v1${path}`;
  try {
    const res = await fetch(url, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function bakuDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Official AZN per 1 unit on date (strict path prefers FINAL from hub). */
export async function getFxRate(
  currency: string,
  date?: string,
  opts?: FxRateClientOptions,
): Promise<FxRatePoint | null> {
  const code = currency.trim().toUpperCase();
  if (code === "AZN" || code === "AZM") {
    return {
      currencyCode: code,
      rate: 1,
      rateDate: date ?? bakuDateKey(),
      status: "FINAL",
    };
  }
  const dateKey = date ?? bakuDateKey();
  const cacheKey = `${dateKey}:${code}`;
  const cached = dateCache.get(cacheKey);
  if (cached && Date.now() - cached.at < DATE_TTL_MS) {
    const hit = cached.value.rates.find((r) => r.currencyCode === code);
    if (hit) return hit;
  }
  const q = new URLSearchParams({ symbols: code, date: dateKey });
  const body = await getJson<FxRatesResponse>(`/fx/rates?${q}`, opts);
  if (!body?.rates?.length) return null;
  dateCache.set(cacheKey, { at: Date.now(), value: body });
  return body.rates.find((r) => r.currencyCode === code) ?? null;
}

export async function getFxRates(
  date?: string,
  symbols = "USD,EUR",
  opts?: FxRateClientOptions,
): Promise<FxRatePoint[]> {
  const dateKey = date ?? bakuDateKey();
  const cacheKey = `${dateKey}:${symbols}`;
  const cached = spotCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SPOT_TTL_MS) {
    return cached.value.rates;
  }
  const q = new URLSearchParams({ symbols });
  if (date) q.set("date", date);
  const body = await getJson<FxRatesResponse>(`/fx/rates?${q}`, opts);
  if (!body?.rates) return [];
  spotCache.set(cacheKey, { at: Date.now(), value: body });
  return body.rates;
}

export async function getFxRatesRange(
  from: string,
  to: string,
  symbol: string,
  opts?: FxRateClientOptions,
): Promise<FxRatesRangeResponse | null> {
  const q = new URLSearchParams({ from, to, symbol });
  return getJson<FxRatesRangeResponse>(`/fx/rates/range?${q}`, opts);
}

export async function convertFx(
  from: string,
  to: string,
  amount: number,
  date?: string,
  opts?: FxRateClientOptions,
): Promise<FxConvertResult | null> {
  const q = new URLSearchParams({
    from: from.trim().toUpperCase(),
    to: to.trim().toUpperCase(),
    amount: String(amount),
  });
  if (date) q.set("date", date);
  return getJson<FxConvertResult>(`/fx/convert?${q}`, opts);
}
