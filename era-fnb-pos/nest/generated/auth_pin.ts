import { authCookieName, enterSatelliteTenant, signSatelliteSession } from "@era/satellite-kit";
import { z } from "zod";
import { jsonOk } from "@/lib/api-utils";
import { clearStaffPinFailures, findActiveStaffByIdForOrg, pinMatches, recordStaffPinFailure } from "@/lib/labor-pin";
import { assertPinLoginQuota } from "@/lib/fnb-quota";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { effectiveRolePermissions, pinRoleToCode } from "@/lib/auth/permissions";
import { findPinRoleByCode } from "@/lib/fnb-roles";
import { ensureFnbSystemRoles, findOutletForPinLogin } from "@/lib/fnb-auth.service";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import { readTerminalCookie, terminalCookieHeader } from "@/lib/terminal-cookie";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const PIN_FAIL_LIMIT = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

const schema = z.object({
  staffId: z.string().min(1),
  pin: z.string().min(4).max(8),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/pin", async (httpReq, httpRes) => {
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

  
    const raw = terminalCookieHeader(request);
    const terminal = readTerminalCookie(raw);
    if (!terminal) return sendJson(httpRes, { error: "TERMINAL_REQUIRED" }, 401);

    const body = schema.parse(httpReq.body);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    assertPinLoginQuota(ip);

    enterSatelliteTenant({ organizationId: terminal.organizationId });
    const outlet = await findOutletForPinLogin(
      terminal.outletId,
      terminal.organizationId,
    );
    if (
      !outlet ||
      (outlet.terminalRevokedAt && outlet.terminalRevokedAt.getTime() >= terminal.boundAt)
    ) {
      return sendJson(httpRes, { error: "TERMINAL_REQUIRED" }, 401);
    }

    const profile = await getFnbOrgProfile(terminal.organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureFnbSystemRoles(terminal.organizationId, edition);

    const staff = await findActiveStaffByIdForOrg(
      body.staffId,
      terminal.organizationId,
    );
    if (!staff || staff.outletId !== outlet.id) {
      pinMatches(null, body.pin);
      return sendJson(httpRes, { error: "Invalid PIN" }, 401);
    }
    if (staff.pinLockedUntil && staff.pinLockedUntil.getTime() > Date.now()) {
      return sendJson(httpRes, { error: "PIN_LOCKED" }, 429);
    }
    if (!pinMatches(staff.pinHash, body.pin)) {
      const fails = staff.pinFailCount + 1;
      await recordStaffPinFailure(
        staff.id,
        fails,
        fails >= PIN_FAIL_LIMIT ? new Date(Date.now() + PIN_LOCK_MS) : null,
      );
      return sendJson(httpRes, { error: fails >= PIN_FAIL_LIMIT ? "PIN_LOCKED" : "Invalid PIN" }, fails >= PIN_FAIL_LIMIT ? 429 : 401);
    }

    await clearStaffPinFailures(staff.id);

    const roleCode = pinRoleToCode(staff.pinRole);
    const role = await findPinRoleByCode(terminal.organizationId, roleCode);
    const permissions = role
      ? effectiveRolePermissions(role.code, role.permissionsJson, edition)
      : [];

    const token = await signSatelliteSession({
      sub: staff.id,
      login: staff.staffCode,
      role: roleCode,
      fullName: staff.fullName,
      organizationId: terminal.organizationId,
      permissions,
      pin: true,
      outletId: staff.outletId ?? undefined,
    });
    const res = jsonOk({
      user: {
        id: staff.id,
        login: staff.staffCode,
        fullName: staff.fullName,
        role: roleCode,
        organizationId: terminal.organizationId,
        outletId: staff.outletId,
        pin: true,
        permissions,
      },
      token,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    const boundOutletId = staff.outletId || outlet.id;
    res.cookies.set(OUTLET_COOKIE, boundOutletId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
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
