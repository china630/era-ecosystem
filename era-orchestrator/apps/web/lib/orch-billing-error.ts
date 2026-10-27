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
  if (typeof o.code === "string" && o.code.trim()) return o.code;
  return fallback;
}
