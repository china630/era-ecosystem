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
