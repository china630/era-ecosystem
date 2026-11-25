/** Lifted from nest/generated/auth_terminal.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, enterSatelliteTenant, isSatelliteUserLoginAllowed } from "@era/satellite-kit";
import { authenticateFnbStaffLogin, ensureFnbSystemRoles, findLiveTerminalOutlet, findOutletForTerminalBind, findUserWithRoleById, listTillCapableOutlets } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { listTerminalStaffRoster } from "@/lib/labor-pin";
import { readTerminalCookie, signTerminalCookie, TERMINAL_COOKIE, TERMINAL_MAX_MS, terminalCookieHeader } from "@/lib/terminal-cookie";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

async function liveTerminal(request: { headers: { get(name: string): string | null } }) {
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


@Controller()
export class AuthTerminalController {
  @Get("api/auth/terminal")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    const live = await liveTerminal({ headers: { get: (name: string) => nestHeader(httpReq, name) } });
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
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/auth/terminal")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    const raw = httpReq.body as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      return sendJson(httpRes, { error: "Invalid JSON" }, 400);
    }
    const outletId =
      typeof raw.outletId === "string" ? raw.outletId.trim() : "";
    const auth = await authenticateFnbStaffLogin({
      headers: { get: (name) => nestHeader(httpReq, name) },
      body: raw,
    });
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
    cookieSeconds(httpRes, authCookieName(), "", 0);
    cookieSeconds(httpRes, TERMINAL_COOKIE, token, Math.floor(TERMINAL_MAX_MS / 1000));
    return sendJson(httpRes, {
      bound: true,
      outletCode: outlet.code,
      outletName: outlet.name,
      staff,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
