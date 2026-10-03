import { createHmac, timingSafeEqual } from "crypto";

export const TERMINAL_COOKIE = "era_fnb_terminal";
export const TERMINAL_MAX_MS = 18 * 60 * 60 * 1000;

export type TerminalClaims = {
  organizationId: string;
  outletId: string;
  boundAt: number;
  exp: number;
};

function secret(): string {
  const value = process.env.AUTH_JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return value;
}

export function signTerminalCookie(input: {
  organizationId: string;
  outletId: string;
  boundAt?: number;
}): string {
  const boundAt = input.boundAt ?? Date.now();
  const body = Buffer.from(
    JSON.stringify({
      organizationId: input.organizationId,
      outletId: input.outletId,
      boundAt,
      exp: boundAt + TERMINAL_MAX_MS,
    } satisfies TerminalClaims),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readTerminalCookie(token: string | null | undefined): TerminalClaims | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TerminalClaims;
    if (!parsed.organizationId || !parsed.outletId || !parsed.boundAt || !parsed.exp) return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function terminalCookieHeader(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${TERMINAL_COOKIE}=`)) continue;
    return decodeURIComponent(trimmed.slice(TERMINAL_COOKIE.length + 1));
  }
  return null;
}
