import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { Controller, Get, Module, Post, Req, Res, UseGuards } from "@nestjs/common";
import { NestFactory, type NestApplication } from "@nestjs/core";
import { SatelliteBillingBlockedError } from "../billing/satellite-billing-gate";
import { authCookieName } from "../auth/session";
import {
  issueSatelliteSessionCookie,
  type SatelliteCookieResponse,
  SATELLITE_SESSION_COOKIE_MAX_AGE_MS,
  SATELLITE_STAFF_SESSION,
  satelliteServiceTokenGuard,
  satelliteStaffSessionGuard,
  type SatelliteNestRequest,
} from "./satellite-nest";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function staffGuard(billingGate: false | (() => Promise<void>)) {
  return satelliteStaffSessionGuard({
    billingGate,
    loadUser: async () => ({ organizationId: ORG, active: true }),
  });
}

@Controller()
class ProbeController {
  @Post("auth/login")
  async login(@Res() res: SatelliteCookieResponse & { json(body: unknown): void }) {
    const token = await issueSatelliteSessionCookie(res, {
      sub: "user-1",
      login: "reception",
      role: "RECEPTION",
      fullName: "Reception",
      organizationId: ORG,
    });
    res.json({ token });
  }

  @Post("auth/sso")
  async sso(@Res() res: SatelliteCookieResponse & { json(body: unknown): void }) {
    const token = await issueSatelliteSessionCookie(res, {
      sub: "sso-1",
      login: "sso_owner",
      role: "BUSINESS_OWNER",
      fullName: "Owner",
      organizationId: ORG,
      email: "owner@example.com",
    });
    res.json({ token });
  }

  @Get("guests")
  @UseGuards(staffGuard(false))
  guests(@Req() req: SatelliteNestRequest) {
    return { organizationId: req[SATELLITE_STAFF_SESSION]?.session.organizationId };
  }

  @Get("export")
  @UseGuards(
    staffGuard(async () => {
      throw new SatelliteBillingBlockedError({
        code: "HARD_BLOCK",
        message: "blocked",
        status: 402,
        billingStatus: "HARD_BLOCK",
      });
    }),
  )
  exportBlocked() {
    return { ok: true };
  }

  @Post("internal")
  @UseGuards(satelliteServiceTokenGuard())
  internal() {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe("satellite nest http", () => {
  let app: NestApplication;
  let base: string;

  before(async () => {
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars";
    process.env.NODE_ENV = "production";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "svc-token-value";
    app = await NestFactory.create(ProbeModule, { logger: false });
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await app.close();
  });

  it("login sets an 8-hour httpOnly cookie and the next request is accepted from that header", async () => {
    const login = await fetch(`${base}/auth/login`, { method: "POST" });
    assert.equal(login.status, 201);
    const setCookie = login.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`^${authCookieName()}=`));
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Max-Age=28800/i);
    assert.equal(SATELLITE_SESSION_COOKIE_MAX_AGE_MS, 8 * 60 * 60 * 1000);
    const guests = await fetch(`${base}/guests`, { headers: { cookie: setCookie.split(";")[0] } });
    assert.equal(guests.status, 200);
    assert.deepEqual(await guests.json(), { organizationId: ORG });
  });

  it("sso sets the same cookie", async () => {
    const sso = await fetch(`${base}/auth/sso`, { method: "POST" });
    const setCookie = sso.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`^${authCookieName()}=`));
    assert.match(setCookie, /Max-Age=28800/i);
  });

  it("rejects a guest call with no cookie", async () => {
    const guests = await fetch(`${base}/guests`);
    assert.equal(guests.status, 401);
  });

  it("returns 402 when billing blocks the request", async () => {
    const login = await fetch(`${base}/auth/login`, { method: "POST" });
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
    const blocked = await fetch(`${base}/export`, { headers: { cookie } });
    assert.equal(blocked.status, 402);
  });

  it("accepts the service token over HTTP and rejects a wrong one", async () => {
    const ok = await fetch(`${base}/internal`, {
      method: "POST",
      headers: { authorization: "Bearer svc-token-value" },
    });
    assert.equal(ok.status, 201);
    const bad = await fetch(`${base}/internal`, {
      method: "POST",
      headers: { authorization: "Bearer other" },
    });
    assert.equal(bad.status, 401);
  });
});
