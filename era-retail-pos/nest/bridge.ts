import type { Response } from "express";
import { describeRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { expressCookieReader, expressHeaderReader, runWithSatelliteTenant } from "@era/satellite-kit";

type StaffRequest = {
  originalUrl?: string;
  url?: string;
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
  __retailSession?: Awaited<ReturnType<typeof getSatelliteSession>>;
};

export async function enterRetailStaff(req: StaffRequest, res: Response): Promise<boolean> {
  try {
    const session = await getSatelliteSession({
      cookies: expressCookieReader(req),
      headers: expressHeaderReader(req),
    });
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    req.__retailSession = session;
    return true;
  } catch (err) {
    await sendRouteError(res, err);
    return false;
  }
}

export async function retailNestSession(req: StaffRequest) {
  return req.__retailSession ?? null;
}

export function runWithRetailTenant<T>(
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
    return runWithRetailTenant(session, fn);
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

/** Next cookie maxAge is seconds. Express maxAge is milliseconds. */
export function cookieSeconds(
  res: Response,
  name: string,
  value: string,
  maxAgeSeconds: number,
  opts?: { httpOnly?: boolean; secure?: boolean },
): void {
  res.cookie(name, value, {
    httpOnly: opts?.httpOnly !== false,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds * 1000,
    secure: opts?.secure,
  });
}

export function sendBytes(res: Response, body: Buffer, headers: Record<string, string>, status = 200): void {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.status(status).send(body);
}

export async function sendRouteError(res: Response, err: unknown): Promise<void> {
  const described = describeRouteError(err);
  if (res.headersSent) return;
  res.status(described.status).json(described.body);
}
