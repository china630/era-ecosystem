/**
 * Shared fail-closed helpers for satellite internal/bridge routes.
 * Production: missing expected secret → deny. Non-production: open only when unset (local smoke).
 */

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
  let expected = "";
  for (const key of opts.expectedEnvKeys) {
    const v = process.env[key]?.trim();
    if (v) {
      expected = v;
      break;
    }
  }
  if (!expected) {
    if (process.env.NODE_ENV === "production" || !allowOpen) {
      return { ok: false, status: 401, error: "Service token not configured" };
    }
    return { ok: true };
  }
  const token = extractBearerOrHeader(
    opts.authorization ?? null,
    opts.xServiceToken ?? null,
  );
  if (!token || token !== expected) {
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
