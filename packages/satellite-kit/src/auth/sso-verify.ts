import { createHmac, timingSafeEqual } from "crypto";

/**
 * SSO HMAC payload.
 * v3 (preferred): email|organizationId|expiresAt|financeRole|jti
 * v2: email|organizationId|expiresAt|financeRole
 * v1 (legacy): email|organizationId|expiresAt — client financeRole MUST be ignored
 */
export function buildSsoPayload(
  email: string,
  organizationId: string,
  expiresAt: number,
  financeRole?: string | null,
  jti?: string | null,
): string {
  const base = `${email}|${organizationId}|${expiresAt}`;
  const role = financeRole?.trim();
  const nonce = jti?.trim();
  if (role && nonce) return `${base}|${role}|${nonce}`;
  if (role) return `${base}|${role}`;
  return base;
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

/**
 * SEC-SSO-02: accept unsigned financeRole only when the HMAC covers it (v2/v3).
 * Legacy v1 signatures verify without role → force USER (no owner escalation).
 * Returns null when signature is invalid.
 */
export function resolveVerifiedSsoFinanceRole(input: {
  email: string;
  organizationId: string;
  expiresAt: number;
  signature: string;
  financeRole?: string | null;
  jti?: string | null;
  secret?: string;
}): string | null {
  const claimed = input.financeRole?.trim() || "";
  const jti = input.jti?.trim() || "";
  if (claimed && jti) {
    const v3 = buildSsoPayload(
      input.email,
      input.organizationId,
      input.expiresAt,
      claimed,
      jti,
    );
    if (verifySsoSignature(v3, input.signature, input.secret)) {
      return claimed;
    }
  }
  if (claimed) {
    const v2 = buildSsoPayload(
      input.email,
      input.organizationId,
      input.expiresAt,
      claimed,
    );
    if (verifySsoSignature(v2, input.signature, input.secret)) {
      return claimed;
    }
  }
  const v1 = buildSsoPayload(input.email, input.organizationId, input.expiresAt);
  if (verifySsoSignature(v1, input.signature, input.secret)) {
    return "USER";
  }
  return null;
}
