/** Lifted from nest/generated/auth_logout.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, expressCookieReader, expressKitHeaders, getBearerOrCookieToken, verifySatelliteSession } from "@era/satellite-kit";
import { LOGIN_CHOICE_COOKIE, LOGIN_CHOICE_MAX_AGE_S, LOGIN_CHOICE_PASSWORD } from "@/lib/auth/login-choice";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

/**
 * Clear the staff session. The terminal pairing cookie stays; a password
 * logout leaves a short choice cookie so the paired tablet opens `/login`.
 * Logout reads only the signed token, so it works for an inactive module or user.
 */

/** Pin flag from the signed token. */
async function signedTokenIsPin(httpReq: Request): Promise<boolean | null> {
  try {
    const token = getBearerOrCookieToken(
      expressCookieReader(httpReq),
      expressKitHeaders(httpReq),
      authCookieName(),
    );
    if (!token) return null;
    return (await verifySatelliteSession(token)).pin === true;
  } catch {
    return null;
  }
}


@Controller()
export class AuthLogoutController {
  @Post("api/auth/logout")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    const pin = await signedTokenIsPin(httpReq);
    cookieSeconds(httpRes, authCookieName(), "", 0);
    if (pin !== null) {
      const password = pin === false;
      cookieSeconds(
        httpRes,
        LOGIN_CHOICE_COOKIE,
        password ? LOGIN_CHOICE_PASSWORD : "",
        password ? LOGIN_CHOICE_MAX_AGE_S : 0,
      );
    }
    return sendJson(httpRes, { ok: true, pin: pin === true });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
