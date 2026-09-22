/**
 * Shared fail-closed helpers for satellite internal/bridge routes.
 * Production: missing expected secret → deny. Non-production: open only when unset (local smoke).
 */
import { isFolkloreS2sToken } from "../tenancy/folklore-s2s-token";
import { getInstallSatelliteEventToken } from "../tenancy/install-s2s-env";

export type ServiceTokenAssertResult =
  | { ok: true }
  | { ok: false; status: 401; error: string };

function extractBearerOrHeader(
  authorization: string | null,
  xServiceToken: string | null,
): string | undefined {
  if (xServiceToken?.trim()) return xServiceToken.trim();
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return authorization?.trim() || undefined;
}

/**
 * Require env token on requests. Fail closed when NODE_ENV=production and env unset.
 */
export function assertEnvServiceToken(opts: {
  expectedEnvKeys: string[];
  authorization?: string | null;
  xServiceToken?: string | null;
  /** When true (default), missing env denies only in production. */
  allowOpenInNonProduction?: boolean;
}): ServiceTokenAssertResult {
  const allowOpen = opts.allowOpenInNonProduction !== false;
  const fromEnv = opts.expectedEnvKeys
    .map((key) => process.env[key]?.trim() || "")
    .filter(Boolean);
  const install = getInstallSatelliteEventToken();
  const candidates = install ? [...fromEnv, install] : fromEnv;
  const real = candidates.filter((v) => !isFolkloreS2sToken(v));
  const acceptable = real.length > 0 ? real : candidates;
  if (acceptable.length === 0) {
    if (process.env.NODE_ENV === "production" || !allowOpen) {
      return { ok: false, status: 401, error: "Service token not configured" };
    }
    return { ok: true };
  }
  const token = extractBearerOrHeader(
    opts.authorization ?? null,
    opts.xServiceToken ?? null,
  );
  if (!token || !acceptable.includes(token)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

/**
 * Bridge secret: header must match when configured; production requires secret set.
 */
export function assertBridgeSecret(opts: {
  expectedEnvKey: string;
  headerValue?: string | null;
}): ServiceTokenAssertResult {
  const expected = process.env[opts.expectedEnvKey]?.trim() ?? "";
  const got = opts.headerValue?.trim() ?? "";
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 401, error: "Bridge secret not configured" };
    }
    return { ok: true };
  }
  if (got !== expected) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
