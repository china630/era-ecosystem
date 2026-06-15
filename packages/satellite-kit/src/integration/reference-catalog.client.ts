/**
 * Direct data-hub client for finance/bank-core only.
 * Industry satellites must use finance-handoffs.client.ts instead.
 */
import type {
  HsMetaPoint,
  HsTariffPoint,
  HubBank,
  HubChartOfAccountsProfile,
  HubCompany,
  HubGeoCity,
  HubGeoCountry,
  HubIbanValidation,
  HubTaxRate,
  HubUom,
} from "@era/contracts";

export type ReferenceCatalogClientOptions = {
  baseUrl?: string;
  serviceToken?: string;
};

function hubBase(opts?: ReferenceCatalogClientOptions): string {
  const raw =
    opts?.baseUrl ??
    process.env.ERA_DATA_HUB_URL ??
    "http://127.0.0.1:4200";
  return raw.replace(/\/$/, "");
}

function hubToken(opts?: ReferenceCatalogClientOptions): string {
  return (
    opts?.serviceToken ??
    process.env.DATA_HUB_SERVICE_TOKEN ??
    ""
  ).trim();
}

async function hubGet<T>(
  path: string,
  opts?: ReferenceCatalogClientOptions,
): Promise<T | null> {
  const token = hubToken(opts);
  if (!token) return null;
  const url = `${hubBase(opts)}/registry/v1${path}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getHsMeta(
  hsCode: string,
  opts?: ReferenceCatalogClientOptions,
): Promise<HsMetaPoint | null> {
  const code = hsCode.replace(/\D/g, "");
  const body = await hubGet<{ hsCode: string; description?: string }>(
    `/hs/${code}`,
    opts,
  );
  if (!body?.hsCode) return null;
  return { hsCode: body.hsCode, description: body.description ?? null };
}

export async function getHsTariff(
  hsCode: string,
  date: string,
  opts?: ReferenceCatalogClientOptions,
): Promise<HsTariffPoint | null> {
  const code = hsCode.replace(/\D/g, "");
  const q = new URLSearchParams({ date });
  const body = await hubGet<HsTariffPoint>(`/hs/${code}/tariff?${q}`, opts);
  return body?.hsCode ? body : null;
}

export async function getCompanyByVoen(
  voen: string,
  opts?: ReferenceCatalogClientOptions & { maskPii?: boolean },
): Promise<HubCompany | null> {
  const id = voen.replace(/\D/g, "");
  const mask = opts?.maskPii === false ? "false" : "true";
  const body = await hubGet<Record<string, unknown>>(
    `/companies/${id}?maskPii=${mask}`,
    opts,
  );
  if (!body) return null;
  return {
    voen: id,
    name: String(body.name ?? body.nameAz ?? id),
    legalAddress: (body.legalAddress as string) ?? null,
    vatStatus: Boolean(body.vatStatus ?? body.isVatPayer),
    legalForm: (body.legalForm as string) ?? null,
  };
}

export async function getBanks(
  opts?: ReferenceCatalogClientOptions,
): Promise<HubBank[]> {
  const body = await hubGet<{ banks: HubBank[] }>("/banks", opts);
  return body?.banks ?? [];
}

export async function validateIban(
  iban: string,
  opts?: ReferenceCatalogClientOptions,
): Promise<HubIbanValidation | null> {
  const q = new URLSearchParams({ iban: iban.trim() });
  return hubGet<HubIbanValidation>(`/iban/validate?${q}`, opts);
}

export async function getUom(
  opts?: ReferenceCatalogClientOptions,
): Promise<HubUom[]> {
  const body = await hubGet<{ units?: HubUom[]; uom?: HubUom[] }>("/uom", opts);
  return body?.units ?? body?.uom ?? [];
}

export async function getTaxRates(
  type: string,
  date: string | undefined,
  opts?: ReferenceCatalogClientOptions,
): Promise<HubTaxRate[]> {
  const q = new URLSearchParams({ type: type.trim().toUpperCase() });
  if (date?.trim()) q.set("date", date.trim());
  const body = await hubGet<{ rates: HubTaxRate[] }>(`/tax-rates?${q}`, opts);
  return body?.rates ?? [];
}

export async function getGeoCountries(
  opts?: ReferenceCatalogClientOptions,
): Promise<HubGeoCountry[]> {
  const body = await hubGet<{ countries: HubGeoCountry[] }>("/geo/countries", opts);
  return body?.countries ?? [];
}

export async function getGeoCities(
  country: string | undefined,
  opts?: ReferenceCatalogClientOptions,
): Promise<HubGeoCity[]> {
  const q = country?.trim() ? `?country=${encodeURIComponent(country.trim())}` : "";
  const body = await hubGet<{ cities: HubGeoCity[] }>(`/geo/cities${q}`, opts);
  return body?.cities ?? [];
}

export async function getChartOfAccounts(
  profile: string,
  opts?: ReferenceCatalogClientOptions,
): Promise<HubChartOfAccountsProfile | null> {
  const q = new URLSearchParams({ profile: profile.trim().toLowerCase() });
  const body = await hubGet<{ accounts: unknown; profile?: string }>(
    `/chart-of-accounts?${q}`,
    opts,
  );
  if (!body?.accounts) return null;
  return { profile: body.profile ?? profile, accounts: body.accounts };
}
