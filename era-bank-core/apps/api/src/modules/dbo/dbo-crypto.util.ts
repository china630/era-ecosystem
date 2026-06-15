import { createHash, createHmac, timingSafeEqual } from "crypto";

export function hashLoginIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier.trim().toUpperCase()).digest("hex");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export type CustomerJwtPayload = {
  sub: string;
  channel: "RETAIL" | "CORPORATE";
  accountIds: string[];
  globalPersonId?: string;
  signatoryRole?: string;
  exp: number;
  iat: number;
};

export function signCustomerJwt(
  payload: Omit<CustomerJwtPayload, "exp" | "iat">,
  secret: string,
  ttlMinutes = 15,
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const full: CustomerJwtPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlMinutes * 60,
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyCustomerJwt(token: string, secret: string): CustomerJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CustomerJwtPayload;
  if (!payload.sub || !payload.channel || !Array.isArray(payload.accountIds)) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}
