import type { Response } from "express";
import { handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { runWithSatelliteTenant } from "@era/satellite-kit";
import { runWithNestHttp } from "@/lib/nest-http-context";

export { runWithNestHttp };

type StaffRequest = {
  originalUrl?: string;
  url?: string;
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
  __crmSession?: Awaited<ReturnType<typeof getSatelliteSession>>;
};

export async function enterCrmStaff(req: StaffRequest, res: Response): Promise<boolean> {
  try {
    const session = await runWithNestHttp(req, () => getSatelliteSession());
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    req.__crmSession = session;
    return true;
  } catch (err) {
    await sendRouteError(res, err);
    return false;
  }
}

export async function crmNestSession(req: StaffRequest) {
  return req.__crmSession ?? null;
}

export function runWithCrmTenant<T>(
  session: { organizationId?: string } | null,
  fn: () => Promise<T>,
): Promise<T> {
  const organizationId = session?.organizationId;
  if (!organizationId) return fn();
  return runWithSatelliteTenant({ organizationId }, fn);
}

export async function runWithStaffTenantIfPresent<T>(req: StaffRequest, fn: () => Promise<T>): Promise<T> {
  try {
    const session = await runWithNestHttp(req, () => getSatelliteSession());
    return runWithCrmTenant(session, fn);
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
  res.status(next.status).json(await next.json());
}

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
