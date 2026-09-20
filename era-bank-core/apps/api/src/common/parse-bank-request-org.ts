export function parseBankRequestOrganizationId(headers?: Record<
  string,
  string | string[] | undefined
>): string | undefined {
  const raw = headers?.["x-organization-id"] ?? headers?.["x-era-organization-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = typeof value === "string" ? value.trim() : "";
  return id || undefined;
}

/** Health, Sync bind/runtime-config, and OpenAPI must not require X-Organization-Id. */
export function isBankRequestTenantExempt(url: string): boolean {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  if (!path) return false;
  if (path.includes("/health") || path.endsWith("/healthz")) return true;
  if (path.includes("/api/internal/")) return true;
  if (path.includes("/docs")) return true;
  return false;
}
