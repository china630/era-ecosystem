/**
 * Edge-only middleware surface — single file, no imports from ./session or main barrel.
 * Next.js middleware must not bundle Node `crypto` (password/sso/orchestrator-gateway).
 */
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { resolveHostBoundLoginOrganizationId } from "../tenancy/login-hostname-memory";
import { orchWebUrl } from "../platform/orch-web-url";

export const DEFAULT_PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/sso/exchange",
  "/api/auth/agency-sso/exchange",
  "/api/health",
  "/api/events/dispatch",
  "/api/locale",
  "/api/internal",
  "/api/integration/staff-provision",
];

/**
 * Public API paths whose handler checks a service secret itself and then trusts
 * the caller's `x-era-organization-id`. Every other path drops the client copy.
 */
export const DEFAULT_SERVICE_API_PREFIXES = ["/api/events/dispatch", "/api/internal"];

export const DEFAULT_PUBLIC_PAGE_PREFIXES = ["/login", "/sso/callback", "/help"];

export const DEFAULT_BARE_PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
  "/register",
  "/register-org",
  "/pricing",
  "/terms",
  "/partner",
];

export const ERA_PATHNAME_HEADER = "x-era-pathname";

/** Prefix for UTF-8 session values in request headers (Fetch Headers = ByteString / latin1). */
export const SESSION_HEADER_UTF8_PREFIX = "utf8:";

/** Encode text for Edge middleware `Headers#set` (throws on code points > 255). */
export function encodeSessionHeaderUtf8(value: string): string {
  if (!value) return value;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) {
      return SESSION_HEADER_UTF8_PREFIX + encodeURIComponent(value);
    }
  }
  return value;
}

/** Decode `encodeSessionHeaderUtf8` values from incoming request headers. */
export function decodeSessionHeaderUtf8(value: string): string {
  if (!value) return value;
  if (value.startsWith(SESSION_HEADER_UTF8_PREFIX)) {
    return decodeURIComponent(value.slice(SESSION_HEADER_UTF8_PREFIX.length));
  }
  return value;
}

export function isPublicApiPath(
  pathname: string,
  extraPrefixes: string[] = [],
): boolean {
  const prefixes = [...DEFAULT_PUBLIC_API_PREFIXES, ...extraPrefixes];
  return prefixes.some((p) => pathname.startsWith(p));
}

export function isBarePublicWebPath(
  pathname: string,
  extraPrefixes: string[] = [],
): boolean {
  const prefixes = [...DEFAULT_BARE_PUBLIC_PAGE_PREFIXES, ...extraPrefixes];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export type HeaderReader = {
  get(name: string): string | null;
};

export function getBearerOrCookieToken(
  cookies: CookieReader,
  headers: HeaderReader,
  cookieName: string,
): string | undefined {
  const cookie = cookies.get(cookieName)?.value;
  if (cookie) return cookie;
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

export function eraPathnameRequestHeaders(
  source: Headers,
  pathname: string,
): Headers {
  const next = new Headers(source);
  next.set(ERA_PATHNAME_HEADER, pathname);
  return next;
}

export function authCookieName(): string {
  return process.env.AUTH_COOKIE_NAME ?? "era_session";
}

function jwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export type EdgeSessionPayload = {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  /** Present when issued at login/SSO — used for platform super-admin gates. */
  email?: string;
  organizationId?: string;
  /** All mapped satellite roles (includes primary `role`). */
  roles?: string[];
  isOwner?: boolean;
  /** Domain permission codes (industry satellite RBAC; optional). */
  permissions?: string[];
  /** F&B PIN sessions — never OrgOwner bypass. */
  pin?: boolean;
  /** Bound outlet for PIN / device sessions. */
  outletId?: string;
};

/** JWT verify for Next.js Edge middleware (jose only — no Node crypto). */
export async function verifySatelliteSession(
  token: string,
): Promise<EdgeSessionPayload> {
  const { payload } = await jwtVerify(token, jwtSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  const rolesRaw = payload.roles;
  const roles = Array.isArray(rolesRaw) ? rolesRaw.map(String) : undefined;
  const permissionsRaw = payload.permissions;
  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw.map(String)
    : undefined;
  return {
    sub,
    login: String(payload.login ?? ""),
    role: String(payload.role ?? ""),
    fullName: String(payload.fullName ?? ""),
    email: payload.email != null ? String(payload.email) : undefined,
    organizationId:
      payload.organizationId != null
        ? String(payload.organizationId)
        : undefined,
    roles,
    isOwner: payload.isOwner === true,
    permissions,
    pin: payload.pin === true,
    outletId: payload.outletId != null ? String(payload.outletId) : undefined,
  };
}

export { resolveHostBoundLoginOrganizationId };

/** Stamp x-era-organization-id on public /login (and /pin) when Host is bound. */
export function nextWithOptionalHostBoundOrg(
  reqHeaders: Headers,
  hostHeader: string | null | undefined,
  satelliteKey?: string | null,
): NextResponse {
  const hostOrg = resolveHostBoundLoginOrganizationId(
    hostHeader,
    satelliteKey,
  );
  if (hostOrg) {
    const headers = new Headers(reqHeaders);
    headers.set("x-era-organization-id", hostOrg);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export function redirectNoStore(url: URL | string): NextResponse {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  return res;
}

/**
 * Structural `NextRequest`: each satellite resolves its own `next` copy, so the
 * kit must not name that type in its signature.
 */
export type SatelliteStaffRequest = {
  nextUrl: {
    pathname: string;
    href: string;
    origin?: string;
    searchParams?: { get(name: string): string | null };
  };
  cookies: CookieReader;
  headers: Headers;
};

export type SatelliteStaffPageContext<R extends SatelliteStaffRequest> = {
  request: R;
  pathname: string;
  session: EdgeSessionPayload;
  reqHeaders: Headers;
};

export type SatelliteStaffApiContext<R extends SatelliteStaffRequest> =
  SatelliteStaffPageContext<R>;

export type SatelliteStaffMiddlewareOptions<R extends SatelliteStaffRequest> = {
  /** Host-bound org on public login pages (`nextWithOptionalHostBoundOrg`). */
  satelliteKey?: string | null;
  /** Added to `DEFAULT_PUBLIC_API_PREFIXES`. */
  publicApiPrefixes?: string[];
  /**
   * Verify the staff token, then pass the original request through. Cloning
   * headers drops Cookie and truncates multipart bodies on POST.
   */
  passthroughApiPrefixes?: string[];
  /**
   * Added to `DEFAULT_SERVICE_API_PREFIXES`: public paths that keep the
   * caller's org header because the handler verifies a service secret first.
   */
  serviceApiPrefixes?: string[];
  /** Pages reachable without a staff session. */
  isPublicPage: (pathname: string) => boolean;
  /** Public pages that receive the host-bound org header. Default `/login`. */
  loginPaths?: string[];
  /**
   * Where a staff page without a valid session goes (path, may carry a query).
   * `reason` is `missing` with no token, `invalid` when it fails to verify.
   * Default `/login`.
   */
  loginRedirectPath?: (request: R, reason: "missing" | "invalid") => string;
  /** Return a response to deny a staff page; nothing → allow. */
  authorizePage?: (
    ctx: SatelliteStaffPageContext<R>,
  ) => Response | null | undefined | Promise<Response | null | undefined>;
  /** Return a response to deny a staff API call after the token verifies; nothing → allow. */
  authorizeApi?: (
    ctx: SatelliteStaffApiContext<R>,
  ) => Response | null | undefined | Promise<Response | null | undefined>;
};

function staffLoginRedirect(request: SatelliteStaffRequest, target: string): NextResponse {
  return redirectNoStore(new URL(target, request.nextUrl.href));
}

const SESSION_ORG_HEADER = "x-era-organization-id";
const SESSION_STAMP_HEADERS = ["x-user-id", "x-user-role", SESSION_ORG_HEADER];

/** Drops client-sent `x-user-id`, `x-user-role`, `x-era-organization-id`. */
export function stripSessionHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  for (const name of SESSION_STAMP_HEADERS) headers.delete(name);
  return headers;
}

/** Client-sent copies are dropped: handlers trust these only from the verified token. */
function stampSessionHeaders(source: Headers, session: EdgeSessionPayload): Headers {
  const headers = stripSessionHeaders(source);
  headers.set("x-user-id", session.sub);
  headers.set("x-user-role", session.role);
  if (session.organizationId) {
    headers.set(SESSION_ORG_HEADER, session.organizationId);
  }
  return headers;
}

/**
 * Passthrough keeps the original request (no header clone), so a client copy
 * of a session header is accepted only when it equals the token value.
 */
function passthroughHeadersMatch(headers: Headers, session: EdgeSessionPayload): boolean {
  const expected: Record<string, string> = {
    "x-user-id": session.sub,
    "x-user-role": session.role,
    [SESSION_ORG_HEADER]: session.organizationId?.trim() ?? "",
  };
  return SESSION_STAMP_HEADERS.every((name) => {
    const sent = headers.get(name)?.trim();
    return !sent || sent === expected[name];
  });
}

/**
 * Gate for staff satellites: reject a missing or invalid session cookie and
 * stamp `x-user-id`, `x-user-role`, `x-era-organization-id` from the token on
 * staff API and page requests. Public paths drop client copies of those
 * headers, except `serviceApiPrefixes` where the handler checks a service secret.
 * Route handlers still read the session with the app `getSatelliteSession`.
 */
/**
 * Partner code on any satellite or Finance page is stored only on the
 * orchestrator origin. Send `?ref=` to `/register` there.
 * `/register` on the orchestrator host is left alone so the page can keep the code.
 */
export function redirectReferralToOrchestratorRegister(request: {
  nextUrl: {
    pathname: string;
    origin?: string;
    searchParams?: { get(name: string): string | null };
  };
}): NextResponse | null {
  const { pathname, origin, searchParams } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return null;
  const ref = searchParams?.get("ref")?.trim();
  if (!ref) return null;
  const orch = orchWebUrl();
  let orchOrigin = orch;
  try {
    orchOrigin = new URL(orch).origin;
  } catch {
    orchOrigin = orch;
  }
  if (
    origin === orchOrigin &&
    (pathname === "/register" || pathname.startsWith("/register/"))
  ) {
    return null;
  }
  const target = new URL("/register", orch);
  target.searchParams.set("ref", ref);
  return NextResponse.redirect(target);
}

export function createSatelliteStaffMiddleware<R extends SatelliteStaffRequest>(
  opts: SatelliteStaffMiddlewareOptions<R>,
): (request: R) => Promise<Response> {
  const cookieName = authCookieName();
  const loginPaths = opts.loginPaths ?? ["/login"];
  const servicePrefixes = [
    ...DEFAULT_SERVICE_API_PREFIXES,
    ...(opts.serviceApiPrefixes ?? []),
  ];

  return async function middleware(request: R): Promise<Response> {
    const referralRedirect = redirectReferralToOrchestratorRegister(request);
    if (referralRedirect) return referralRedirect;
    const { pathname } = request.nextUrl;

    if (opts.passthroughApiPrefixes?.some((p) => pathname.startsWith(p))) {
      const token = getBearerOrCookieToken(request.cookies, request.headers, cookieName);
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      let session: EdgeSessionPayload;
      try {
        session = await verifySatelliteSession(token);
      } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
      if (!passthroughHeadersMatch(request.headers, session)) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
      return NextResponse.next();
    }

    const pathHeaders = eraPathnameRequestHeaders(request.headers, pathname);
    const reqHeaders = stripSessionHeaders(pathHeaders);

    if (pathname.startsWith("/api")) {
      if (isPublicApiPath(pathname, opts.publicApiPrefixes)) {
        const isService = servicePrefixes.some((p) => pathname.startsWith(p));
        return NextResponse.next({
          request: { headers: isService ? pathHeaders : reqHeaders },
        });
      }
      const token = getBearerOrCookieToken(request.cookies, request.headers, cookieName);
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      let session: EdgeSessionPayload;
      try {
        session = await verifySatelliteSession(token);
      } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
      const apiHeaders = stampSessionHeaders(reqHeaders, session);
      const denied = await opts.authorizeApi?.({
        request,
        pathname,
        session,
        reqHeaders: apiHeaders,
      });
      if (denied) return denied;
      return NextResponse.next({ request: { headers: apiHeaders } });
    }

    if (opts.isPublicPage(pathname)) {
      if (loginPaths.includes(pathname)) {
        return nextWithOptionalHostBoundOrg(
          reqHeaders,
          request.headers.get("x-forwarded-host") || request.headers.get("host"),
          opts.satelliteKey,
        );
      }
      return NextResponse.next({ request: { headers: reqHeaders } });
    }

    const loginTarget = (reason: "missing" | "invalid") =>
      opts.loginRedirectPath?.(request, reason) ?? "/login";
    const token = getBearerOrCookieToken(request.cookies, request.headers, cookieName);
    if (!token) return staffLoginRedirect(request, loginTarget("missing"));
    try {
      const session = await verifySatelliteSession(token);
      const pageHeaders = stampSessionHeaders(reqHeaders, session);
      const denied = await opts.authorizePage?.({
        request,
        pathname,
        session,
        reqHeaders: pageHeaders,
      });
      if (denied) return denied;
      return NextResponse.next({ request: { headers: pageHeaders } });
    } catch {
      return staffLoginRedirect(request, loginTarget("invalid"));
    }
  };
}

export function agencyAuthCookieName(): string {
  return process.env.AGENCY_AUTH_COOKIE_NAME ?? "era_agency_session";
}

export type AgencySessionPayload = {
  sub: string;
  actor: "agency";
  email: string;
  fullName: string;
  organizationId: string;
  agencyId: string;
  agencyCode?: string;
};

/** Edge-safe agency JWT verify (jose only). */
export async function verifyAgencySession(
  token: string,
): Promise<AgencySessionPayload> {
  const { payload } = await jwtVerify(token, jwtSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  if (payload.actor !== "agency") throw new Error("Not an agency session");
  return {
    sub,
    actor: "agency",
    email: String(payload.email ?? ""),
    fullName: String(payload.fullName ?? ""),
    organizationId: String(payload.organizationId ?? ""),
    agencyId: String(payload.agencyId ?? ""),
    agencyCode: payload.agencyCode ? String(payload.agencyCode) : undefined,
  };
}
