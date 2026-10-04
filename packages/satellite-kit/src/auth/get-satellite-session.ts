import {
  enterSatelliteTenant,
  type SatelliteTenantContext,
} from "../tenancy/satellite-tenant-context";
import {
  getBearerOrCookieToken,
  type CookieReader,
  type HeaderReader,
} from "./middleware-helpers";
import {
  authCookieName,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "./session";

/** A verified staff session: the org is always present. */
export type SatelliteStaffSessionPayload = SatelliteSessionPayload & { organizationId: string };

/** The staff row behind a session token, as each satellite loads it. */
export type SatelliteSessionUser = {
  organizationId: string | null | undefined;
  active: boolean;
};

export type ReadSatelliteStaffSessionInput<U extends SatelliteSessionUser> = {
  cookies: CookieReader;
  /** Bearer token source only; the org header is never read here. */
  headers: HeaderReader;
  /** Runs inside the token org tenant. Missing row → no session. */
  loadUser: (session: SatelliteStaffSessionPayload) => Promise<U | null | undefined>;
  cookieName?: string;
  enterTenant?: (ctx: SatelliteTenantContext) => void;
};

export type SatelliteStaffSession<U extends SatelliteSessionUser> = {
  session: SatelliteStaffSessionPayload;
  user: U;
};

/**
 * Staff session for a satellite route handler: verify the cookie (or Bearer),
 * take the org from the signed token, enter that tenant, and load the staff
 * row. No org claim, no row, an inactive row, or a row in another org → null.
 * Neither the request header nor the process bind is used.
 */
export async function readSatelliteStaffSession<U extends SatelliteSessionUser>(
  input: ReadSatelliteStaffSessionInput<U>,
): Promise<SatelliteStaffSession<U> | null> {
  const token = getBearerOrCookieToken(
    input.cookies,
    input.headers,
    input.cookieName ?? authCookieName(),
  );
  if (!token) return null;

  let payload: SatelliteSessionPayload;
  try {
    payload = await verifySatelliteSession(token);
  } catch {
    return null;
  }

  const organizationId = payload.organizationId?.trim();
  if (!organizationId) return null;

  (input.enterTenant ?? enterSatelliteTenant)({ organizationId });
  const session = { ...payload, organizationId };
  const user = await input.loadUser(session);
  if (!user || !user.active) return null;
  if (user.organizationId?.trim() !== organizationId) return null;
  return { session, user };
}
