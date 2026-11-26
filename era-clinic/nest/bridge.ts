import type { Response } from "express";
import { HttpException } from "@nestjs/common";
import {
  SatelliteStaffSessionGuard,
  SATELLITE_STAFF_SESSION,
  type SatelliteNestRequest,
} from "@era/satellite-kit/nest";
import { handleRouteError } from "@/lib/api-utils";
import {
  enrichClinicStaffSession,
  loadClinicSessionUser,
  type ClinicSessionUser,
} from "@/lib/api-utils";
import { runWithSatelliteTenant, agencyAuthCookieName, getBearerOrCookieToken } from "@era/satellite-kit";
import { runWithBoundClinicSession } from "@/lib/api-utils";
import { runWithNestHttp } from "@/lib/nest-http-context";
import { ClinicJson } from "@/lib/clinic-json";

type StaffRequest = SatelliteNestRequest & {
  originalUrl?: string;
  params?: Record<string, string>;
  body?: unknown;
  [SATELLITE_STAFF_SESSION]?: {
    session: { organizationId: string };
    user: ClinicSessionUser;
  };
};

export const clinicStaffGuard = new SatelliteStaffSessionGuard({
  loadUser: loadClinicSessionUser,
});

export async function enterClinicStaff(req: StaffRequest, res: Response): Promise<boolean> {
  try {
    await clinicStaffGuard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    } as never);
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "getStatus" in err && "getResponse" in err) {
      const httpErr = err as HttpException;
      const status = httpErr.getStatus();
      if (status === 401) {
        res.status(401).json({ error: "Unauthorized" });
        return false;
      }
      res.status(status).json(httpErr.getResponse());
      return false;
    }
    throw err;
  }
}

export async function clinicNestSession(req: StaffRequest) {
  const found = req[SATELLITE_STAFF_SESSION];
  if (!found) throw new Error("Unauthorized");
  const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
  return enrichClinicStaffSession(found as never, path);
}

export async function runWithClinicTenant<T>(
  session: { organizationId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const organizationId = session.organizationId?.trim();
  if (!organizationId) throw new Error("Unauthorized");
  return runWithSatelliteTenant({ organizationId }, fn);
}

export async function runWithStaffTenantIfPresent<T>(req: StaffRequest, fn: () => Promise<T>): Promise<T> {
  try {
    await clinicStaffGuard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    } as never);
  } catch {
    return fn();
  }
  const session = await clinicNestSession(req);
  return runWithClinicTenant(session, () => runWithBoundClinicSession(session as never, fn));
}

export function nestQuery(req: StaffRequest): URLSearchParams {
  const url = new URL(req.originalUrl ?? req.url ?? "/", "http://127.0.0.1");
  return url.searchParams;
}

export function sendJson(res: Response, data: unknown, status = 200): void {
  res.status(status).json(data);
}

export function sendBytes(
  res: Response,
  body: Buffer,
  headers: Record<string, string>,
  status = 200,
): void {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.status(status).send(body);
}

export async function readNestForm(req: StaffRequest): Promise<FormData> {
  const type = String(req.get?.("content-type") ?? "");
  if (!type.includes("multipart/form-data")) {
    throw new TypeError(
      'Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".',
    );
  }
  const boundary = type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] ?? type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) {
    throw new TypeError(
      'Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".',
    );
  }
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
  const form = new FormData();
  for (const part of raw.toString("latin1").split(`--${boundary}`)) {
    const sep = part.indexOf("\r\n\r\n");
    if (sep < 0) continue;
    const head = part.slice(0, sep);
    let body = part.slice(sep + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    const name = head.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const filename = head.match(/filename="([^"]*)"/)?.[1];
    if (filename === undefined) {
      form.append(name, Buffer.from(body, "latin1").toString("utf8"));
      continue;
    }
    const mime = head.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] ?? "application/octet-stream";
    form.append(name, new File([Buffer.from(body, "latin1")], filename, { type: mime }));
  }
  return form;
}

export function rejectMissingAgency(req: StaffRequest, res: Response): boolean {
  const token = getBearerOrCookieToken(
    {
      get: (name: string) => {
        const raw = String(req.headers?.cookie ?? "");
        for (const part of raw.split(";")) {
          const eq = part.indexOf("=");
          if (eq <= 0) continue;
          if (part.slice(0, eq).trim() === name) {
            return { value: decodeURIComponent(part.slice(eq + 1).trim()) };
          }
        }
        return undefined;
      },
    },
    { get: (name: string) => req.get?.(name) ?? null },
    agencyAuthCookieName(),
  );
  if (token) return false;
  res.status(401).json({ error: "Unauthorized" });
  return true;
}

export function nestHeader(req: StaffRequest, name: string): string | null {
  const incoming = req.get?.(name);
  if (incoming) return incoming;
  if (name.toLowerCase() === "x-era-organization-id") {
    return req[SATELLITE_STAFF_SESSION]?.session.organizationId ?? null;
  }
  return null;
}

/** Absolute URL plus method for guards that only read pathname and query. */
export function clinicRoute(req: StaffRequest): { url: string; method: string } {
  return {
    url: new URL(req.originalUrl ?? req.url ?? "/", "http://127.0.0.1").toString(),
    method: req.method ?? "GET",
  };
}

/** Staff route: tenant ALS. Returns the domain value. */
export function withClinicStaff<T>(
  req: StaffRequest,
  session: { organizationId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  return runWithClinicTenant(session, () =>
    runWithBoundClinicSession(session as never, fn),
  );
}

/** Public route: Nest frame, staff tenant when a session cookie is present. */
export function withClinicHttp<T>(req: StaffRequest, fn: () => Promise<T>): Promise<T> {
  // Nest has no next/headers — getSatelliteSession() needs the Express cookie jar
  // via nestHttpFrame (same pattern as CRM/logistics bridges).
  return runWithNestHttp(req, () => runWithStaffTenantIfPresent(req, fn));
}

/** Turn a ClinicJson into a Nest return or HttpException. Status 200 yields the body. */
export function clinicBody(value: ClinicJson): unknown {
  if (value.status !== 200) throw new HttpException(value.body, value.status);
  return value.body;
}

export async function sendRouteError(res: Response, err: unknown): Promise<void> {
  if (err instanceof Error && err.message.includes(" invocation in")) {
    err.message = err.message.replace(/`tx\./g, "`prisma.");
    err.message = err.message.replace(
      / invocation in[\s\S]*?\n\n(?=[A-Z])/,
      " invocation:\n\n\n",
    );
  }
  const next = handleRouteError(err);
  res.status(next.status).json(await next.json());
}

export async function sendWebResponse(
  res: Response,
  next: {
    status: number;
    json?: () => Promise<unknown>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
    headers?: {
      forEach?: (fn: (value: string, key: string) => void) => void;
      getSetCookie?: () => string[];
    };
  },
): Promise<void> {
  if (typeof next.arrayBuffer !== "function") {
    res.status(next.status).json(await next.json?.());
    return;
  }
  const bytes = Buffer.from(await next.arrayBuffer());
  const cookies = next.headers?.getSetCookie?.() ?? [];
  next.headers?.forEach?.((value, key) => {
    if (key === "transfer-encoding" || key === "content-length" || key === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.status(next.status).send(bytes);
}
