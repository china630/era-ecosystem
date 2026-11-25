/** Lifted from nest/generated/auth_pin.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, enterSatelliteTenant, signSatelliteSession } from "@era/satellite-kit";
import { z } from "zod";
import { clearStaffPinFailures, findActiveStaffByIdForOrg, pinMatches, recordStaffPinFailure } from "@/lib/labor-pin";
import { assertPinLoginQuota } from "@/lib/fnb-quota";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { effectiveRolePermissions, pinRoleToCode } from "@/lib/auth/permissions";
import { findPinRoleByCode } from "@/lib/fnb-roles";
import { ensureFnbSystemRoles, findOutletForPinLogin } from "@/lib/fnb-auth.service";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import { readTerminalCookie, terminalCookieHeader } from "@/lib/terminal-cookie";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const PIN_FAIL_LIMIT = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

const schema = z.object({
  staffId: z.string().min(1),
  pin: z.string().min(4).max(8),
});


@Controller()
export class AuthPinController {
  @Post("api/auth/pin")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    const raw = terminalCookieHeader({ headers: { get: (name: string) => nestHeader(httpReq, name) } });
    const terminal = readTerminalCookie(raw);
    if (!terminal) return sendJson(httpRes, { error: "TERMINAL_REQUIRED" }, 401);

    const body = schema.parse(httpReq.body);
    const ip =
      nestHeader(httpReq, "x-forwarded-for")?.split(",")[0]?.trim() ||
      nestHeader(httpReq, "x-real-ip") ||
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
    const boundOutletId = staff.outletId || outlet.id;
    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    cookieSeconds(httpRes, OUTLET_COOKIE, boundOutletId, 60 * 60 * 24 * 30);
    return sendJson(httpRes, {
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
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
