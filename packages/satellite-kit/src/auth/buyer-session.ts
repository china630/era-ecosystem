import { SignJWT, jwtVerify } from "jose";

export type BuyerSessionPayload = {
  sub: string;
  actor: "buyer";
  email: string;
  fullName: string;
  organizationId: string;
  counterpartyId: string;
};

function getSessionSecret(): Uint8Array {
  const secret =
    process.env.AUTH_JWT_SECRET?.trim() ||
    process.env.ERA_JWT_SECRET?.trim() ||
    "";
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET (or ERA_JWT_SECRET) must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export function buyerAuthCookieName(): string {
  return process.env.BUYER_AUTH_COOKIE_NAME ?? "era_buyer_session";
}

export async function signBuyerSession(
  payload: BuyerSessionPayload,
): Promise<string> {
  return new SignJWT({
    actor: "buyer",
    email: payload.email,
    fullName: payload.fullName,
    organizationId: payload.organizationId,
    counterpartyId: payload.counterpartyId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSessionSecret());
}

export async function verifyBuyerSession(
  token: string,
): Promise<BuyerSessionPayload> {
  const { payload } = await jwtVerify(token, getSessionSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  if (payload.actor !== "buyer") throw new Error("Not a buyer session");
  return {
    sub,
    actor: "buyer",
    email: String(payload.email ?? ""),
    fullName: String(payload.fullName ?? ""),
    organizationId: String(payload.organizationId ?? ""),
    counterpartyId: String(payload.counterpartyId ?? ""),
  };
}
