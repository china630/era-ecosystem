/** Compose / .env.example placeholders — must not shadow a real droplet secret. */
const FOLKLORE_S2S_TOKENS = new Set([
  "dev-control-plane-token",
  "dev-satellite-event-token",
]);

/**
 * True for empty, exact compose defaults, or `change-me…` placeholders
 * (`change-me-satellite-event-token_!@…`, `change-me-sso-hmac-secret…`).
 */
export function isFolkloreS2sToken(token: string | undefined | null): boolean {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return true;
  if (FOLKLORE_S2S_TOKENS.has(t)) return true;
  if (t.toLowerCase().startsWith("change-me")) return true;
  return false;
}
