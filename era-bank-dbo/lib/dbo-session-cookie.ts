import { createHmac, timingSafeEqual } from "crypto";
import type { DboChannel } from "@prisma/client";

export const DBO_SESSION_COOKIE = "era_bank_dbo_session";

export type DboSessionPayload = {
  sessionId: string;
  customerId: string;
  channel: DboChannel;
  exp: number;
};

function jwtSecret(): string {
  const secret = process.env.BANK_DBO_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("BANK_DBO_JWT_SECRET must be at least 16 characters");
  }
  return secret;
}

function buildPayload(sessionId: string, customerId: string, channel: DboChannel, exp: number): string {
  return `${sessionId}|${customerId}|${channel}|${exp}`;
}

export function signDboSessionCookie(payload: DboSessionPayload): string {
  const body = buildPayload(payload.sessionId, payload.customerId, payload.channel, payload.exp);
  const sig = createHmac("sha256", jwtSecret()).update(body).digest("hex");
  const encoded = Buffer.from(body, "utf8").toString("base64url");
  return `${encoded}.${sig}`;
}

export function verifyDboSessionCookie(token: string): DboSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", jwtSecret()).update(body).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const [sessionId, customerId, channel, expStr] = body.split("|");
  const exp = Number(expStr);
  if (!sessionId || !customerId || !channel || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  if (channel !== "RETAIL" && channel !== "CORPORATE") return null;
  return { sessionId, customerId, channel, exp };
}
