import { createHmac, timingSafeEqual } from "crypto";

/** HMAC-SHA256 hex digest for outbound webhook bodies (P2 scaffold). */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyWebhookPayload(
  secret: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  const expected = signWebhookPayload(secret, rawBody);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHex.trim(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}