import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { SatelliteBillingBlockedError } from "../billing/satellite-billing-gate";
import { assertEnvServiceToken } from "../auth/assert-service-token";
import {
  readSatelliteStaffSession,
  type ReadSatelliteStaffSessionInput,
  type SatelliteSessionUser,
  type SatelliteStaffSession,
} from "../auth/get-satellite-session";
import {
  ERA_METHOD_HEADER,
  ERA_PATHNAME_HEADER,
  type CookieReader,
  type HeaderReader,
} from "../auth/middleware-helpers";
import { authCookieName, signSatelliteSession, type SatelliteSessionPayload } from "../auth/session";

export {
  SatelliteMutationAuditInterceptor,
  createSatelliteApiController,
  type SatelliteMutationAuditRow,
} from "./satellite-mutation-audit";

export const SATELLITE_STAFF_SESSION = "satelliteStaffSession";

/** Express `res.cookie` maxAge is milliseconds. Next `cookies().set` maxAge is seconds. */
export const SATELLITE_SESSION_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

type HeaderBag = {
  get?(name: string): string | null | undefined;
} & Record<string, string | string[] | undefined>;

export type SatelliteNestRequest = {
  headers?: HeaderBag;
  cookies?: Record<string, string | undefined>;
  method?: string;
  url?: string;
  originalUrl?: string;
  [SATELLITE_STAFF_SESSION]?: SatelliteStaffSession<SatelliteSessionUser>;
};

export type SatelliteCookieResponse = {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
    },
  ): void;
};

function headerValue(req: SatelliteNestRequest, name: string): string | null {
  const headers = req.headers;
  if (!headers) return null;
  if (typeof headers.get === "function") {
    return headers.get(name) ?? null;
  }
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function requestPath(req: SatelliteNestRequest): string {
  const url = req.originalUrl ?? req.url ?? "";
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
}

function headerReader(req: SatelliteNestRequest): HeaderReader {
  return {
    get(name: string) {
      const stamped = headerValue(req, name);
      if (stamped) return stamped;
      const key = name.toLowerCase();
      if (key === ERA_METHOD_HEADER) return req.method ?? null;
      if (key === ERA_PATHNAME_HEADER) return requestPath(req) || null;
      return null;
    },
  };
}

/** Express does not fill `req.cookies` until a parser runs. The guard reads the header itself. */
export function readCookieHeader(header: string | null | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function cookieBag(req: SatelliteNestRequest): Record<string, string | undefined> {
  if (req.cookies) return req.cookies;
  return readCookieHeader(headerValue(req, "cookie"));
}

function cookieReader(req: SatelliteNestRequest): CookieReader {
  const cookies = cookieBag(req);
  return {
    get(name: string) {
      const value = cookies[name];
      return value ? { value } : undefined;
    },
  };
}

function requestOf(context: ExecutionContext): SatelliteNestRequest {
  return context.switchToHttp().getRequest<SatelliteNestRequest>();
}

export type SatelliteStaffSessionGuardOptions<U extends SatelliteSessionUser> = Pick<
  ReadSatelliteStaffSessionInput<U>,
  "loadUser" | "billingGate" | "enterTenant" | "cookieName"
>;

/**
 * Nest cannot inject the satellite options, so the guard is a class with no
 * constructor arguments. Register `satelliteStaffSessionGuard(options)`.
 */
export function satelliteStaffSessionGuard<U extends SatelliteSessionUser>(
  options: SatelliteStaffSessionGuardOptions<U>,
): new () => CanActivate {
  @Injectable()
  class Guard extends SatelliteStaffSessionGuard<U> {
    constructor() {
      super(options);
    }
  }
  return Guard;
}

export class SatelliteStaffSessionGuard<U extends SatelliteSessionUser = SatelliteSessionUser>
  implements CanActivate
{
  constructor(private readonly options: SatelliteStaffSessionGuardOptions<U>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = requestOf(context);
    try {
      const found = await readSatelliteStaffSession({
        ...this.options,
        cookies: cookieReader(req),
        headers: headerReader(req),
      });
      if (!found) throw new UnauthorizedException();
      req[SATELLITE_STAFF_SESSION] = found;
      return true;
    } catch (err) {
      if (err instanceof SatelliteBillingBlockedError) {
        throw new HttpException(
          { error: err.message, code: err.code, billingStatus: err.billingStatus },
          err.status,
        );
      }
      throw err;
    }
  }
}

/** Same reason as {@link satelliteStaffSessionGuard}: env keys are not a Nest token. */
export function satelliteServiceTokenGuard(
  expectedEnvKeys: string[] = ["SATELLITE_EVENT_SERVICE_TOKEN"],
): new () => CanActivate {
  @Injectable()
  class Guard extends SatelliteServiceTokenGuard {
    constructor() {
      super(expectedEnvKeys);
    }
  }
  return Guard;
}

export class SatelliteServiceTokenGuard implements CanActivate {
  constructor(
    private readonly expectedEnvKeys: string[] = ["SATELLITE_EVENT_SERVICE_TOKEN"],
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = requestOf(context);
    const headers = headerReader(req);
    const result = assertEnvServiceToken({
      expectedEnvKeys: this.expectedEnvKeys,
      authorization: headers.get("authorization"),
      xServiceToken: headers.get("x-service-token"),
    });
    if (!result.ok) throw new UnauthorizedException(result.error);
    return true;
  }
}

/** Login and SSO share this: sign the kit session and set the 8-hour staff cookie. */
export async function issueSatelliteSessionCookie(
  res: SatelliteCookieResponse,
  payload: SatelliteSessionPayload,
): Promise<string> {
  const token = await signSatelliteSession(payload);
  applySatelliteSessionCookie(res, token);
  return token;
}

export function applySatelliteSessionCookie(
  res: SatelliteCookieResponse,
  token: string,
  maxAgeMs: number = SATELLITE_SESSION_COOKIE_MAX_AGE_MS,
  cookieName: string = authCookieName(),
): void {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  });
}
