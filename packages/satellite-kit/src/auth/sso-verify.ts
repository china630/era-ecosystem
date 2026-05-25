import { createHmac, timingSafeEqual } from "crypto";

export function buildSsoPayload(
  email: string,
  organizationId: string,
  expiresAt: number,
): string {
  return `${email}|${organizationId}|${expiresAt}`;
}

export function verifySsoSignature(
  payload: string,
  signature: string,
  secret?: string,
): boolean {
  const key = secret ?? process.env.ERA_SSO_SHARED_SECRET;
  if (!key) return false;
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
