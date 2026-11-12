import { authCookieName, enterSatelliteTenant, isSatelliteUserLoginAllowed } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { authenticateFnbStaffLogin, ensureFnbSystemRoles, findLiveTerminalOutlet, findOutletForTerminalBind, findUserWithRoleById, listTillCapableOutlets } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { listTerminalStaffRoster } from "@/lib/labor-pin";
import { readTerminalCookie, signTerminalCookie, TERMINAL_COOKIE, TERMINAL_MAX_MS, terminalCookieHeader } from "@/lib/terminal-cookie";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

async function liveTerminal(request: Request) {
  const claims = readTerminalCookie(terminalCookieHeader(request));
  if (!claims) return null;
  enterSatelliteTenant({ organizationId: claims.organizationId });
  const outlet = await findLiveTerminalOutlet(
    claims.outletId,
    claims.organizationId,
  );
  if (!outlet) return null;
  if (outlet.terminalRevokedAt && outlet.terminalRevokedAt.getTime() >= claims.boundAt) {
    return null;
  }
  return { claims, outlet };
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/auth/terminal", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const live = await liveTerminal(request);
    if (!live) return sendJson(httpRes, { bound: false });
    const staff = await listTerminalStaffRoster(
      live.claims.organizationId,
      live.outlet.id,
    );
    return sendJson(httpRes, {
      bound: true,
      outletCode: live.outlet.code,
      outletName: live.outlet.name,
      staff,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/auth/terminal", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const raw = (httpReq.body.catch(() => null)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      return sendJson(httpRes, { error: "Invalid JSON" }, 400);
    }
    const outletId =
      typeof raw.outletId === "string" ? raw.outletId.trim() : "";
    const authReq = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw),
    });
    const auth = await authenticateFnbStaffLogin(authReq);
    if (!auth.ok) return sendJson(httpRes, { error: auth.error }, auth.status);
    const user = auth.user;
    const organizationId = auth.organizationId;
    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureFnbSystemRoles(organizationId, edition);
    const refreshed = await findUserWithRoleById(user.id);
    if (!refreshed || !isSatelliteUserLoginAllowed(refreshed)) {
      return sendJson(httpRes, { error: "Invalid credentials" }, 401);
    }
    const bypass = hasFnbPermissionBypass({
      login: refreshed.login,
      email: refreshed.email ?? undefined,
      role: refreshed.role.code,
      isOwner: false,
    });
    const manager = refreshed.role.code === ROLE_CODES.MANAGER;
    if (!bypass && !manager) {
      return sendJson(httpRes, { error: "TERMINAL_BIND_DENIED" }, 403);
    }
    if (!outletId) {
      const outlets = await listTillCapableOutlets(organizationId);
      return sendJson(httpRes, { needOutlet: true, outlets });
    }
    const outlet = await findOutletForTerminalBind(outletId, organizationId);
    if (!outlet) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    if (outlet.capTill === false) {
      return sendJson(httpRes, { error: "Outlet has no till — pick a floor/café point" }, 400);
    }
    const boundAt = Date.now();
    const token = signTerminalCookie({
      organizationId,
      outletId: outlet.id,
      boundAt,
    });
    const staff = await listTerminalStaffRoster(organizationId, outlet.id);
    const res = jsonOk({
      bound: true,
      outletCode: outlet.code,
      outletName: outlet.name,
      staff,
    });
    res.cookies.set(authCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set(TERMINAL_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(TERMINAL_MAX_MS / 1000),
    });
    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
