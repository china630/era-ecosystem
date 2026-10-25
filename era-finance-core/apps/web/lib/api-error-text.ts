/** Stable `code` values from DisputeFreezeGuard. */
const SECURITY_BLOCK_CODES = new Set([
  "HARD_BLOCK_PLATFORM",
  "DISPUTE_DELETE_FROZEN",
  "DISPUTE_ARCHIVE_FROZEN",
  "DISPUTE_SUBSCRIPTION_FROZEN",
  "DISPUTE_OWNERSHIP_FROZEN",
  "DISPUTE_MIGRATION_FROZEN",
  "DISPUTE_HARD_DELETE_FROZEN",
]);

export type ParsedApiError = {
  message: string;
  code?: string;
};

export function parseApiErrorPayload(text: string): ParsedApiError {
  const trimmed = text.trim().slice(0, 800);
  if (!trimmed) return { message: "" };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return { message: trimmed };
    const body = parsed as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code : undefined;
    if (typeof body.message === "string") return { message: body.message, code };
    if (Array.isArray(body.message) && body.message.every((item) => typeof item === "string")) {
      return { message: body.message.join("; "), code };
    }
    if (typeof body.error === "string") return { message: body.error, code };
  } catch {
    /* plain text */
  }
  return { message: trimmed };
}

type Translate = (key: string, options?: { defaultValue?: string }) => string;

/** Localized sentence for a platform security block, or null when the code is unknown. */
export function securityBlockText(t: Translate, code: string | undefined): string | null {
  if (!code || !SECURITY_BLOCK_CODES.has(code)) return null;
  const key = `common.securityBlock.${code}`;
  const text = t(key, { defaultValue: "" });
  return text && text !== key ? text : null;
}
