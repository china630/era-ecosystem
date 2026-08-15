/**
 * Catalog / ENTITY_REF options for bank ops forms.
 * Options load from BFF list endpoints (era-bank → era-bank-core).
 */

export type LookupOption = { value: string; label: string };

export const CURRENCY_OPTIONS: LookupOption[] = [
  { value: "AZN", label: "AZN" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export const PAYMENT_RAIL_OPTIONS: LookupOption[] = [
  { value: "AZIPS", label: "AZIPS" },
  { value: "XOHKS", label: "XÖHKS" },
  { value: "AOS", label: "AÖS" },
  { value: "SWIFT", label: "SWIFT" },
  { value: "INTERNAL", label: "Internal" },
];

export const CUSTOMER_TYPE_OPTIONS: LookupOption[] = [
  { value: "NATURAL", label: "Natural" },
  { value: "LEGAL", label: "Legal" },
];

export const IFRS9_STAGE_OPTIONS: LookupOption[] = [
  { value: "1", label: "Stage 1" },
  { value: "2", label: "Stage 2" },
  { value: "3", label: "Stage 3 (NPL)" },
];

export const PAYMENT_STATUS_OPTIONS: LookupOption[] = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "PENDING_APPROVAL", label: "PENDING_APPROVAL" },
  { value: "APPROVED", label: "APPROVED" },
  { value: "SETTLED", label: "SETTLED" },
  { value: "REJECTED", label: "REJECTED" },
];

export function withOrphanOption(
  options: LookupOption[],
  current: string | null | undefined,
): LookupOption[] {
  if (!current) return options;
  if (options.some((o) => o.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadBranchOptions(): Promise<LookupOption[]> {
  const data = await fetchJson<Array<{ id?: string; code?: string; name?: string }>>(
    "/api/branches",
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((b) => ({
      value: String(b.id ?? b.code ?? ""),
      label: b.name
        ? `${b.code ?? b.id} — ${b.name}`
        : String(b.code ?? b.id ?? ""),
    }))
    .filter((o) => o.value);
}

export async function loadProductTemplateOptions(
  kind?: string,
  status = "ACTIVE",
): Promise<LookupOption[]> {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (status) params.set("status", status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJson<
    Array<{
      id?: string;
      moduleKey?: string;
      name?: string;
      kind?: string;
      status?: string;
      paramsJson?: Record<string, unknown>;
    }>
  >(`/api/product-templates${qs}`);
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => ({
      value: String(p.id ?? ""),
      label: p.name
        ? `${p.name}${p.kind ? ` (${p.kind})` : ""}`
        : String(p.moduleKey ?? p.id ?? ""),
    }))
    .filter((o) => o.value);
}

export async function loadProductTemplateDetail(
  id: string,
): Promise<Record<string, unknown> | null> {
  return fetchJson(`/api/product-templates/${encodeURIComponent(id)}`);
}

export async function loadGlAccountOptions(): Promise<LookupOption[]> {
  const data = await fetchJson<Array<{ id?: string; code?: string; name?: string }>>(
    "/api/gl/accounts",
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((g) => ({
      value: String(g.code ?? ""),
      label: g.name
        ? `${g.code} — ${g.name}`
        : String(g.code ?? g.id ?? ""),
    }))
    .filter((o) => o.value);
}

export async function loadAccountOptions(
  customerId?: string,
): Promise<LookupOption[]> {
  const qs = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
  const data = await fetchJson<
    Array<{ id?: string; iban?: string; currency?: string }>
  >(`/api/accounts${qs}`);
  if (!Array.isArray(data)) return [];
  return data
    .map((a) => ({
      value: String(a.id ?? ""),
      label: a.iban
        ? `${a.iban}${a.currency ? ` (${a.currency})` : ""}`
        : String(a.id ?? ""),
    }))
    .filter((o) => o.value);
}

export async function loadCustomerOptions(): Promise<LookupOption[]> {
  const data = await fetchJson<
    Array<{ id?: string; customerType?: string; voen?: string | null }>
  >("/api/cif/customers");
  if (!Array.isArray(data)) return [];
  return data
    .map((c) => ({
      value: String(c.id ?? ""),
      label: c.voen
        ? `${c.id} — ${c.customerType ?? ""} VOEN ${c.voen}`
        : `${c.id ?? ""} (${c.customerType ?? "—"})`,
    }))
    .filter((o) => o.value);
}

/** Convert major AZN (decimal string/number) to minor units (qepik). */
export function majorToMinor(major: string | number): number {
  const n =
    typeof major === "number"
      ? major
      : Number.parseFloat(String(major).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatAznMajor(minor: unknown): string {
  const n = typeof minor === "bigint" ? Number(minor) : Number(minor ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 100).toFixed(2)} AZN`;
}
