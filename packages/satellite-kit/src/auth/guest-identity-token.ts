import { createHmac, timingSafeEqual } from "crypto";

export type GuestIdentityTokenPayload = {
  globalPersonId: string;
  expiresAt: number;
};

export function buildGuestIdentityPayload(
  globalPersonId: string,
  expiresAt: number,
): string {
  return `${globalPersonId}|${expiresAt}`;
}

export function signGuestIdentityToken(
  globalPersonId: string,
  expiresAt: number,
  secret?: string,
): string {
  const key = secret ?? process.env.ERA_GUEST_IDENTITY_SECRET ?? process.env.ERA_SSO_SHARED_SECRET;
  if (!key) {
    throw new Error("ERA_GUEST_IDENTITY_SECRET or ERA_SSO_SHARED_SECRET is not configured");
  }
  const payload = buildGuestIdentityPayload(globalPersonId, expiresAt);
  const sig = createHmac("sha256", key).update(payload).digest("hex");
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sig}`;
}

export function defaultGuestIdentityExpiresAt(ttlSeconds = 86400 * 30): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

export function verifyGuestIdentityToken(
  token: string,
  secret?: string,
): GuestIdentityTokenPayload | null {
  const key = secret ?? process.env.ERA_GUEST_IDENTITY_SECRET ?? process.env.ERA_SSO_SHARED_SECRET;
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const [globalPersonId, expiresAtStr] = payload.split("|");
  const expiresAt = Number(expiresAtStr);
  if (!globalPersonId || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Math.floor(Date.now() / 1000)) return null;
  return { globalPersonId, expiresAt };
}
