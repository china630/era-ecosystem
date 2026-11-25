/**
 * Public webchat/form guards: signed math captcha + rate limit (P1-5 / audit v4 §5.2).
 * In-memory rate + burn maps are single-node; prefer Redis when available (follow-up).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const RATE = new Map<string, { count: number; resetAt: number }>();
/** Burned challenge ids (jti) until expiry — one-shot tokens. */
const BURNED = new Map<string, number>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Fail-closed in production without CRM_INTEGRATIONS_KEK (no JWT / hardcoded). */
export function hookGuardSecret(): string {
  const kek = process.env.CRM_INTEGRATIONS_KEK?.trim();
  if (kek) return kek;
  if (isProduction()) {
    throw new Error(
      "CRM_INTEGRATIONS_KEK is required in production for public hook captcha",
    );
  }
  return (
    process.env.JWT_SECRET?.trim() ||
    "era-crm-dev-hook-guard"
  );
}

function secret(): string {
  return hookGuardSecret();
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function pruneBurned(now: number): void {
  if (BURNED.size < 500) return;
  for (const [k, exp] of BURNED) {
    if (exp <= now) BURNED.delete(k);
  }
}

/** Sliding window: max `limit` hits per `windowMs` for key (ip+publicId). */
export function assertPublicRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const row = RATE.get(key);
  if (!row || row.resetAt <= now) {
    RATE.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (row.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
    };
  }
  row.count += 1;
  return { ok: true };
}

export type MathChallenge = { a: number; b: number; token: string };

/** Issue a+b captcha; token is HMAC-signed with jti + expiry (10 min). */
export function issueMathChallenge(): MathChallenge {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const exp = Date.now() + 10 * 60_000;
  const jti = b64url(randomBytes(12));
  const payload = b64url(
    Buffer.from(JSON.stringify({ a, b, exp, jti }), "utf8"),
  );
  const sig = createHmac("sha256", secret()).update(payload).digest();
  return { a, b, token: `${payload}.${b64url(sig)}` };
}

/**
 * Verify + burn jti (one-shot). Returns false on bad/expired/replay.
 */
export function verifyMathChallenge(
  token: string | undefined,
  answer: unknown,
): boolean {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sigPart] = token.split(".");
  if (!payload || !sigPart) return false;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", secret()).update(payload).digest();
  } catch {
    return false;
  }
  let got: Buffer;
  try {
    got = fromB64url(sigPart);
  } catch {
    return false;
  }
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return false;
  }
  let data: { a?: number; b?: number; exp?: number; jti?: string };
  try {
    data = JSON.parse(fromB64url(payload).toString("utf8")) as {
      a?: number;
      b?: number;
      exp?: number;
      jti?: string;
    };
  } catch {
    return false;
  }
  if (!data.exp || Date.now() > data.exp) return false;
  const n = Number(answer);
  if (!Number.isFinite(n)) return false;
  if (n !== Number(data.a) + Number(data.b)) return false;
  const jti = data.jti?.trim();
  if (!jti) return false;
  const now = Date.now();
  pruneBurned(now);
  if (BURNED.has(jti)) return false;
  BURNED.set(jti, data.exp);
  return true;
}

/** Test helper — clear in-memory maps. */
export function _resetPublicHookGuardForTests(): void {
  RATE.clear();
  BURNED.clear();
}
