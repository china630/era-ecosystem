import { cookies, headers } from "next/headers";
import {
  authCookieName,
  getBearerOrCookieToken,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import {
  LOGIN_CHOICE_COOKIE,
  LOGIN_CHOICE_MAX_AGE_S,
  LOGIN_CHOICE_PASSWORD,
} from "@/lib/auth/login-choice";
/**
 * Clear the staff session. The terminal pairing cookie stays; a password
 * logout leaves a short choice cookie so the paired tablet opens `/login`.
 * Logout reads only the signed token, so it works for an inactive module or user.
 */

/** Pin flag from the signed token. */
async function signedTokenIsPin(): Promise<boolean | null> {
  try {
    const token = getBearerOrCookieToken(
      await cookies(),
      await headers(),
      authCookieName(),
    );
    if (!token) return null;
    return (await verifySatelliteSession(token)).pin === true;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const pin = await signedTokenIsPin();
    const res = jsonOk({ ok: true, pin: pin === true });
    res.cookies.set(authCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    if (pin !== null) {
      const password = pin === false;
      res.cookies.set(LOGIN_CHOICE_COOKIE, password ? LOGIN_CHOICE_PASSWORD : "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: password ? LOGIN_CHOICE_MAX_AGE_S : 0,
      });
    }
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
