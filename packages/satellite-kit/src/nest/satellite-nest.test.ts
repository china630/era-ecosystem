import assert from "node:assert/strict";
import { describe, it, before, afterEach } from "node:test";
import { ExecutionContext, HttpException, UnauthorizedException } from "@nestjs/common";
import { signSatelliteSession, authCookieName } from "../auth/session";
import { SatelliteBillingBlockedError } from "../billing/satellite-billing-gate";
import {
  applySatelliteSessionCookie,
  SATELLITE_SESSION_COOKIE_MAX_AGE_MS,
  SATELLITE_STAFF_SESSION,
  satelliteServiceTokenGuard,
  SatelliteStaffSessionGuard,
  satelliteStaffSessionGuard,
  type SatelliteNestRequest,
} from "./satellite-nest";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function context(req: SatelliteNestRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe("satellite nest edge", () => {
  const previousEnv = {
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    SATELLITE_EVENT_SERVICE_TOKEN: process.env.SATELLITE_EVENT_SERVICE_TOKEN,
  };

  before(() => {
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars";
  });

  afterEach(() => {
    process.env.NODE_ENV = previousEnv.NODE_ENV;
    if (previousEnv.SATELLITE_EVENT_SERVICE_TOKEN === undefined) {
      delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    } else {
      process.env.SATELLITE_EVENT_SERVICE_TOKEN = previousEnv.SATELLITE_EVENT_SERVICE_TOKEN;
    }
  });

  it("accepts a signed staff cookie and stores the session", async () => {
    const token = await signSatelliteSession({
      sub: "user-1",
      login: "reception",
      role: "RECEPTION",
      fullName: "Reception",
      organizationId: ORG,
    });
    const req: SatelliteNestRequest = {
      cookies: { [authCookieName()]: token },
      headers: { "x-era-method": "GET", "x-era-pathname": "/api/guests" },
    };
    const guard = new SatelliteStaffSessionGuard({
      billingGate: false,
      loadUser: async () => ({ organizationId: ORG, active: true }),
    });
    assert.equal(await guard.canActivate(context(req)), true);
    assert.equal(req[SATELLITE_STAFF_SESSION]?.session.organizationId, ORG);
    assert.equal(req[SATELLITE_STAFF_SESSION]?.session.sub, "user-1");
  });

  it("rejects a request with no cookie and no bearer", async () => {
    const guard = new SatelliteStaffSessionGuard({
      billingGate: false,
      loadUser: async () => ({ organizationId: ORG, active: true }),
    });
    await assert.rejects(
      () => guard.canActivate(context({ headers: {} })),
      (err: unknown) => err instanceof UnauthorizedException,
    );
  });

  it("rejects a bad token", async () => {
    const guard = new SatelliteStaffSessionGuard({
      billingGate: false,
      loadUser: async () => ({ organizationId: ORG, active: true }),
    });
    await assert.rejects(
      () =>
        guard.canActivate(
          context({ cookies: { [authCookieName()]: "not-a-jwt" }, headers: {} }),
        ),
      (err: unknown) => err instanceof UnauthorizedException,
    );
  });

  it("turns a billing block into 402", async () => {
    const token = await signSatelliteSession({
      sub: "user-1",
      login: "reception",
      role: "RECEPTION",
      fullName: "Reception",
      organizationId: ORG,
    });
    const guard = new SatelliteStaffSessionGuard({
      loadUser: async () => ({ organizationId: ORG, active: true }),
      billingGate: async () => {
        throw new SatelliteBillingBlockedError({
          code: "HARD_BLOCK",
          message: "blocked",
          status: 402,
          billingStatus: "HARD_BLOCK",
        });
      },
    });
    await assert.rejects(
      () =>
        guard.canActivate(
          context({
            cookies: { [authCookieName()]: token },
            headers: { "x-era-method": "POST", "x-era-pathname": "/api/guests" },
          }),
        ),
      (err: unknown) => err instanceof HttpException && err.getStatus() === 402,
    );
  });

  it("accepts the configured service token and rejects a wrong one", () => {
    process.env.NODE_ENV = "production";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "svc-token-value";
    const Guard = satelliteServiceTokenGuard();
    const guard = new Guard();
    assert.equal(
      guard.canActivate(
        context({ headers: { authorization: "Bearer svc-token-value" } }),
      ),
      true,
    );
    assert.throws(
      () => guard.canActivate(context({ headers: { authorization: "Bearer other" } })),
      (err: unknown) => err instanceof UnauthorizedException,
    );
  });

  it("uses the Nest method and path when the Next stamps are absent", async () => {
    const token = await signSatelliteSession({
      sub: "user-1",
      login: "reception",
      role: "RECEPTION",
      fullName: "Reception",
      organizationId: ORG,
    });
    let seen: { method: string; path: string } | undefined;
    const Guard = satelliteStaffSessionGuard({
      loadUser: async () => ({ organizationId: ORG, active: true }),
      billingGate: async (input) => {
        seen = { method: input.method, path: input.path };
      },
    });
    const guard = new Guard();
    assert.equal(guard.constructor.length, 0);
    assert.equal(
      await guard.canActivate(
        context({
          method: "GET",
          originalUrl: "/api/guests?q=1",
          cookies: { [authCookieName()]: token },
          headers: {},
        }),
      ),
      true,
    );
    assert.deepEqual(seen, { method: "GET", path: "/api/guests" });
  });

  it("sets the staff session cookie with the kit name and httpOnly", () => {
    let set: { name: string; value: string; options: { httpOnly: boolean; sameSite: string; path: string; maxAge: number } } | undefined;
    applySatelliteSessionCookie(
      {
        cookie(name, value, options) {
          set = { name, value, options };
        },
      },
      "signed-token",
    );
    assert.equal(set?.name, authCookieName());
    assert.equal(set?.value, "signed-token");
    assert.equal(set?.options.httpOnly, true);
    assert.equal(set?.options.sameSite, "lax");
    assert.equal(set?.options.path, "/");
    assert.equal(set?.options.maxAge, SATELLITE_SESSION_COOKIE_MAX_AGE_MS);
  });
});
