import { ORG_NO_RE } from "../auth/resolve-login-org";

/**
 * ERA-owned subdomain login convenience (A5b) — not white-label SKU.
 * Example: 104221.clinic.era-365.online → orgNo 104221 when pool host is clinic.era-365.online
 */

export type EraSubdomainOrgResult =
  | { orgNo: string; poolHost: string }
  | { mismatch: true }
  | null;

/**
 * Parse Host / x-forwarded-host for `{6digits}.{poolSuffix}`.
 * `poolSuffixes` are apex pool hosts without the orgNo label
 * (e.g. ["clinic.era-365.online", "hotel-pms.era-365.online"]).
 */
export function parseEraOrgSubdomain(
  hostHeader: string | null | undefined,
  poolSuffixes: readonly string[],
): EraSubdomainOrgResult {
  if (!hostHeader?.trim() || poolSuffixes.length === 0) return null;
  const host = hostHeader.split(",")[0]?.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;

  for (const rawSuffix of poolSuffixes) {
    const suffix = rawSuffix.trim().toLowerCase().replace(/\.$/, "");
    if (!suffix) continue;
    if (host === suffix) return null;
    const needle = `.${suffix}`;
    if (!host.endsWith(needle)) continue;
    const label = host.slice(0, host.length - needle.length);
    if (!ORG_NO_RE.test(label)) continue;
    return { orgNo: label, poolHost: suffix };
  }
  return null;
}

/**
 * When Host implies an orgNo and the client also sent ?org= / body orgNo,
 * they must match (ADR).
 */
export function assertOrgNoMatchesHost(
  hostOrgNo: string | null | undefined,
  clientOrgNo: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!hostOrgNo?.trim()) return { ok: true };
  if (!clientOrgNo?.trim()) return { ok: true };
  if (hostOrgNo.trim() === clientOrgNo.trim()) return { ok: true };
  return { ok: false, error: "Organization code does not match host" };
}

/** Env `ERA_LOGIN_POOL_HOSTS` comma-separated, or empty → feature off. */
export function loginPoolHostSuffixesFromEnv(): string[] {
  const raw = process.env.ERA_LOGIN_POOL_HOSTS?.trim() || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
