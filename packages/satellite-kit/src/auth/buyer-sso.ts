import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { z } from "zod";
import { getRuntimeSsoSharedSecret } from "../tenancy/runtime-config-memory";

/** buyer|{email}|{organizationId}|{counterpartyId}|{expiresAt}[|{jti}] */
export function buildBuyerSsoPayload(
  email: string,
  organizationId: string,
  counterpartyId: string,
  expiresAt: number,
  jti?: string | null,
): string {
  const base = `buyer|${email.trim().toLowerCase()}|${organizationId}|${counterpartyId}|${expiresAt}`;
  const nonce = jti?.trim();
  return nonce ? `${base}|${nonce}` : base;
}

export function signBuyerSsoPayload(
  params: {
    email: string;
    organizationId: string;
    counterpartyId: string;
    expiresAt: number;
    jti?: string | null;
  },
  secret?: string,
): string {
  const key =
    secret ?? getRuntimeSsoSharedSecret() ?? process.env.ERA_SSO_SHARED_SECRET;
  if (!key) throw new Error("ERA_SSO_SHARED_SECRET is not configured");
  const payload = buildBuyerSsoPayload(
    params.email,
    params.organizationId,
    params.counterpartyId,
    params.expiresAt,
    params.jti,
  );
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function verifyBuyerSsoSignature(input: {
  email: string;
  organizationId: string;
  counterpartyId: string;
  expiresAt: number;
  signature: string;
  jti?: string | null;
  secret?: string;
}): boolean {
  const key =
    input.secret ?? getRuntimeSsoSharedSecret() ?? process.env.ERA_SSO_SHARED_SECRET;
  if (!key) return false;
  const withJti = buildBuyerSsoPayload(
    input.email,
    input.organizationId,
    input.counterpartyId,
    input.expiresAt,
    input.jti,
  );
  const expected = createHmac("sha256", key).update(withJti).digest("hex");
  try {
    if (
      timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.signature, "hex"))
    ) {
      return true;
    }
  } catch {
    /* fall through */
  }
  if (input.jti) {
    const without = buildBuyerSsoPayload(
      input.email,
      input.organizationId,
      input.counterpartyId,
      input.expiresAt,
    );
    const expected2 = createHmac("sha256", key).update(without).digest("hex");
    try {
      return timingSafeEqual(
        Buffer.from(expected2, "hex"),
        Buffer.from(input.signature, "hex"),
      );
    } catch {
      return false;
    }
  }
  return false;
}

export const buyerSsoExchangeBodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).optional(),
  organizationId: z.string().min(1),
  counterpartyId: z.string().min(1),
  expiresAt: z.number().int(),
  signature: z.string().min(1),
  jti: z.string().min(8).max(128).optional(),
});

export type BuyerSsoExchangeBody = z.infer<typeof buyerSsoExchangeBodySchema>;

export function newBuyerSsoJti(): string {
  return randomUUID().replace(/-/g, "");
}
