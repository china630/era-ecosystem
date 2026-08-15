/**
 * Channel session cookie — Web Crypto only (Edge middleware + Node route handlers).
 * Do not import Node `crypto` or `@prisma/client` here.
 */

export const DBO_SESSION_COOKIE = "era_bank_dbo_session";

export type DboChannel = "RETAIL" | "CORPORATE";

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

function buildPayload(
  sessionId: string,
  customerId: string,
  channel: DboChannel,
  exp: number,
): string {
  return `${sessionId}|${customerId}|${channel}|${exp}`;
}

function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    utf8ToBytes(data) as BufferSource,
  );
  return bytesToHex(new Uint8Array(sig));
}

export async function signDboSessionCookie(
  payload: DboSessionPayload,
): Promise<string> {
  const body = buildPayload(
    payload.sessionId,
    payload.customerId,
    payload.channel,
    payload.exp,
  );
  const sig = await hmacSha256Hex(jwtSecret(), body);
  const encoded = toBase64Url(utf8ToBytes(body));
  return `${encoded}.${sig}`;
}

export async function verifyDboSessionCookie(
  token: string,
): Promise<DboSessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  let body: string;
  try {
    body = bytesToUtf8(fromBase64Url(encoded));
  } catch {
    return null;
  }

  let expected: string;
  try {
    expected = await hmacSha256Hex(jwtSecret(), body);
  } catch {
    return null;
  }

  try {
    if (!timingSafeEqualBytes(hexToBytes(sig), hexToBytes(expected))) {
      return null;
    }
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
