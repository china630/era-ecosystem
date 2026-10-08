import {
  enterSatelliteTenant,
  type SatelliteTenantContext,
} from "../tenancy/satellite-tenant-context";
import {
  assertSatelliteBillingAllows,
  type SatelliteBillingGate,
} from "../billing/satellite-billing-gate";
import {
  ERA_METHOD_HEADER,
  ERA_PATHNAME_HEADER,
  getBearerOrCookieToken,
  type CookieReader,
  type HeaderReader,
} from "./middleware-helpers";
import { isPlatformSuperAdminUser } from "./platform-super-admin";
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
  /** Bearer token source, plus the kit middleware method/path stamps; the org header is never read. */
  headers: HeaderReader;
  /** Runs inside the token org tenant. Missing row → no session. */
  loadUser: (session: SatelliteStaffSessionPayload) => Promise<U | null | undefined>;
  cookieName?: string;
  enterTenant?: (ctx: SatelliteTenantContext) => void;
  /** Billing SOFT/HARD gate. Default asks the orchestrator; `false` skips (tests). */
  billingGate?: SatelliteBillingGate | false;
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
 *
 * Then the billing gate: a call the orchestrator denies (SOFT_BLOCK export,
 * HARD_BLOCK write) throws `SatelliteBillingBlockedError` (402). Platform
 * super-admins skip it. Without the middleware method stamp the call counts as a write.
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

  const gate = input.billingGate ?? assertSatelliteBillingAllows;
  if (gate && !isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
    await gate({
      organizationId,
      method: input.headers.get(ERA_METHOD_HEADER)?.trim() || "POST",
      path: input.headers.get(ERA_PATHNAME_HEADER)?.trim() || "",
    });
  }
  return { session, user };
}
