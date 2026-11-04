/** Nest may return `{ message }` or `{ message: { message } }` / `{ code }`. */
export function orchBillingErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) return o.message;
  if (Array.isArray(o.message) && typeof o.message[0] === "string") return o.message[0];
  if (o.message && typeof o.message === "object") {
    const nested = (o.message as Record<string, unknown>).message;
    if (typeof nested === "string" && nested.trim()) return nested;
  }
  const code = orchBillingErrorCode(body);
  if (code) return code;
  return fallback;
}

/** Nest `BadRequestException({ code, … })` often nests under `message`. */
export function orchBillingErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.code === "string" && o.code.trim()) return o.code.trim();
  if (o.message && typeof o.message === "object") {
    const nested = (o.message as Record<string, unknown>).code;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

export function orchBillingErrorPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const o = body as Record<string, unknown>;
  if (o.message && typeof o.message === "object" && !Array.isArray(o.message)) {
    return o.message as Record<string, unknown>;
  }
  return o;
}
