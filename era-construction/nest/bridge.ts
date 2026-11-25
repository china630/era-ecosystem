import type { CookieOptions, Response } from "express";
import { handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { authCookieName, expressCookieReader, expressHeaderReader, runWithSatelliteTenant } from "@era/satellite-kit";
import { expressCookieFromSeconds } from "./native/cookie-opts";

export { expressCookieFromSeconds };

type StaffRequest = {
  originalUrl?: string;
  url?: string;
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
  __constructionSession?: Awaited<ReturnType<typeof getSatelliteSession>>;
};

const AUTH_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
};

export async function enterConstructionStaff(req: StaffRequest, res: Response): Promise<boolean> {
  try {
    const session = await getSatelliteSession({
      cookies: expressCookieReader(req),
      headers: expressHeaderReader(req),
    });
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    req.__constructionSession = session;
    return true;
  } catch (err) {
    await sendRouteError(res, err);
    return false;
  }
}

export async function constructionNestSession(req: StaffRequest) {
  return req.__constructionSession ?? null;
}

export function runWithConstructionTenant<T>(
  session: { organizationId?: string } | null,
  fn: () => Promise<T>,
): Promise<T> {
  const organizationId = session?.organizationId;
  if (!organizationId) return fn();
  return runWithSatelliteTenant({ organizationId }, fn);
}

export async function runWithStaffTenantIfPresent<T>(req: StaffRequest, fn: () => Promise<T>): Promise<T> {
  try {
    const session = await getSatelliteSession({
      cookies: expressCookieReader(req),
      headers: expressHeaderReader(req),
    });
    return runWithConstructionTenant(session, fn);
  } catch {
    return fn();
  }
}

export function nestHeader(req: StaffRequest, name: string): string | null {
  const incoming = req.get?.(name);
  if (incoming) return incoming;
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (Array.isArray(value)) return value[0] == null ? null : String(value[0]);
  return value == null ? null : String(value);
}

export function nestQuery(): URLSearchParams {
  return new URLSearchParams();
}

export function rejectMissingAgency(): boolean {
  return false;
}

export async function readNestForm(): Promise<FormData> {
  throw new TypeError("multipart is not mounted on this Nest edge yet");
}

export function sendJson(res: Response, data: unknown, status = 200): void {
  res.status(status).json(data);
}

export function sendBytes(res: Response, body: Buffer, headers: Record<string, string>, status = 200): void {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.status(status).send(body);
}

export async function sendRouteError(res: Response, err: unknown): Promise<void> {
  const next = handleRouteError(err);
  res.status(next.status).json(next.body);
}

/** Copy a Web Fetch `Response` (kit handlers) onto Express — not Next-specific. */
export async function sendWebResponse(res: Response, next: globalThis.Response): Promise<void> {
  const bytes = Buffer.from(await next.arrayBuffer());
  const cookies = typeof next.headers.getSetCookie === "function" ? next.headers.getSetCookie() : [];
  next.headers.forEach((value, key) => {
    if (key === "transfer-encoding" || key === "content-length" || key === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.status(next.status).send(bytes);
}

/**
 * Express `res.cookie` maxAge is milliseconds (Next cookies.set used seconds).
 * Default TTL matches the former Nest/Next auth cookie (8h).
 */
export function setStaffAuthCookie(res: Response, token: string, maxAgeSec = 60 * 60 * 8): void {
  res.cookie(authCookieName(), token, {
    ...AUTH_COOKIE_OPTS,
    ...expressCookieFromSeconds({ maxAge: maxAgeSec }),
  });
}

export function clearStaffAuthCookie(res: Response): void {
  res.cookie(authCookieName(), "", { ...AUTH_COOKIE_OPTS, maxAge: 0 });
}
