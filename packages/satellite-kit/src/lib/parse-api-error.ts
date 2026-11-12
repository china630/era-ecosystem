import { isRoleForbiddenPayload } from "../auth/role-forbidden";

const ROLE_DENIED_TEXT = {
  en: "Your role does not include this action.",
  az: "Bu əməliyyata icazəniz yoxdur.",
  ru: "У вашей роли нет этого действия.",
} as const;

function roleDeniedText(): string {
  if (typeof document === "undefined") return ROLE_DENIED_TEXT.en;
  const html = document.documentElement.lang?.slice(0, 2);
  if (html === "az" || html === "ru" || html === "en") return ROLE_DENIED_TEXT[html];
  const match = document.cookie.match(/(?:^|; )era_i18n_lang=([^;]+)/);
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  if (value === "az" || value === "ru" || value === "en") return ROLE_DENIED_TEXT[value];
  return ROLE_DENIED_TEXT.en;
}

/** Parse NestJS / plain API error bodies into a single human-readable message. */
export function parseApiError(body: unknown, fallback = "Request failed"): string {
  if (body == null || body === "") return fallback;

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return fallback;
    try {
      return parseApiError(JSON.parse(trimmed), fallback);
    } catch {
      return trimmed;
    }
  }

  if (typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (isRoleForbiddenPayload(record)) return roleDeniedText();
    const message = record.message;
    if (typeof message === "string" && message.trim()) return message.trim();
    if (Array.isArray(message)) {
      const parts = message.filter(
        (m): m is string => typeof m === "string" && Boolean(m.trim()),
      );
      if (parts.length) return parts.join(". ");
    }
    if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
    if (typeof record.detail === "string" && record.detail.trim()) return record.detail.trim();
  }

  return fallback;
}
