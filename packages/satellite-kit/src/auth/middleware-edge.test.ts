import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { createSatelliteStaffMiddleware } from "./middleware-edge";
import { signSatelliteSession } from "./session";

const ORG_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_FORGED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const COOKIE = "era_test_session";

function request(pathname: string, token?: string, headers: Record<string, string> = {}) {
  return {
    nextUrl: { pathname, href: `http://clinic.test${pathname}` },
    cookies: {
      get(name: string) {
        return name === COOKIE && token ? { value: token } : undefined;
      },
    },
    headers: new Headers(headers),
  };
}

/** Next encodes `NextResponse.next({ request: { headers } })` overrides this way. */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

describe("createSatelliteStaffMiddleware", () => {
  let middleware: ReturnType<typeof createSatelliteStaffMiddleware>;

  before(() => {
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars";
    process.env.AUTH_COOKIE_NAME = COOKIE;
    middleware = createSatelliteStaffMiddleware({
      passthroughApiPrefixes: ["/api/import"],
      isPublicPage: (p) => p === "/login",
    });
  });

  async function token(organizationId?: string) {
    return signSatelliteSession({
      sub: "user-1",
      email: "staff@era.test",
      login: "staff",
      fullName: "Staff",
      role: "STAFF",
      ...(organizationId ? { organizationId } : {}),
    });
  }

  it("rejects staff API without a cookie", async () => {
    const res = await middleware(request("/api/patients"));
    assert.equal(res.status, 401);
  });

  it("replaces a client-sent org header with the token org on staff API", async () => {
    const res = await middleware(
      request("/api/patients", await token(ORG_TOKEN), {
        "x-era-organization-id": ORG_FORGED,
        "x-user-id": "someone-else",
      }),
    );
    assert.equal(forwarded(res, "x-era-organization-id"), ORG_TOKEN);
    assert.equal(forwarded(res, "x-user-id"), "user-1");
  });

  it("drops a client-sent org header when the token has no org", async () => {
    const res = await middleware(
      request("/api/patients", await token(), { "x-era-organization-id": ORG_FORGED }),
    );
    assert.notEqual(forwarded(res, "x-era-organization-id"), ORG_FORGED);
  });

  it("stamps the token org on staff pages", async () => {
    const res = await middleware(
      request("/visits", await token(ORG_TOKEN), { "x-era-organization-id": ORG_FORGED }),
    );
    assert.equal(forwarded(res, "x-era-organization-id"), ORG_TOKEN);
  });

  it("redirects staff pages without a cookie to /login", async () => {
    const res = await middleware(request("/visits"));
    assert.equal(res.status, 307);
    assert.equal(new URL(res.headers.get("location")!).pathname, "/login");
  });

  it("sends staff pages without a session to the chosen login path", async () => {
    const pinFirst = createSatelliteStaffMiddleware({
      isPublicPage: (p) => p === "/login" || p === "/pin",
      loginRedirectPath: () => "/pin",
    });
    const missing = await pinFirst(request("/floor"));
    const invalid = await pinFirst(request("/floor", "garbage"));
    assert.equal(new URL(missing.headers.get("location")!).pathname, "/pin");
    assert.equal(new URL(invalid.headers.get("location")!).pathname, "/pin");
  });

  it("passes the reason so a missing cookie can keep ?from=", async () => {
    const withFrom = createSatelliteStaffMiddleware({
      isPublicPage: (p) => p === "/login",
      loginRedirectPath: (req, reason) =>
        reason === "missing"
          ? `/login?${new URLSearchParams({ from: req.nextUrl.pathname })}`
          : "/login",
    });
    const missing = new URL((await withFrom(request("/accounts"))).headers.get("location")!);
    const invalid = new URL(
      (await withFrom(request("/accounts", "garbage"))).headers.get("location")!,
    );
    assert.equal(missing.pathname, "/login");
    assert.equal(missing.searchParams.get("from"), "/accounts");
    assert.equal(invalid.searchParams.get("from"), null);
  });

  it("rejects passthrough when the sent org header differs from the token", async () => {
    const res = await middleware(
      request("/api/import/x", await token(ORG_TOKEN), {
        "x-era-organization-id": ORG_FORGED,
      }),
    );
    assert.equal(res.status, 401);
  });

  it("passes passthrough with a matching or absent org header", async () => {
    const t = await token(ORG_TOKEN);
    const same = await middleware(
      request("/api/import/x", t, { "x-era-organization-id": ORG_TOKEN }),
    );
    const none = await middleware(request("/api/import/x", t));
    assert.equal(same.status, 200);
    assert.equal(none.status, 200);
  });

  it("rejects passthrough when a sent user header differs from the token", async () => {
    const res = await middleware(
      request("/api/import/x", await token(ORG_TOKEN), { "x-user-id": "someone-else" }),
    );
    assert.equal(res.status, 401);
  });

  it("drops a client-sent org header on public API paths", async () => {
    const res = await middleware(
      request("/api/auth/login", undefined, {
        "x-era-organization-id": ORG_FORGED,
        "x-user-id": "someone-else",
      }),
    );
    assert.equal(forwarded(res, "x-era-organization-id"), null);
    assert.equal(forwarded(res, "x-user-id"), null);
  });

  it("keeps the caller org header on service API paths", async () => {
    const res = await middleware(
      request("/api/events/dispatch", undefined, { "x-era-organization-id": ORG_TOKEN }),
    );
    assert.equal(forwarded(res, "x-era-organization-id"), ORG_TOKEN);
  });

  it("keeps the caller org header on app service prefixes", async () => {
    const withBridge = createSatelliteStaffMiddleware({
      publicApiPrefixes: ["/api/capacity/summary"],
      serviceApiPrefixes: ["/api/capacity/summary"],
      isPublicPage: (p) => p === "/login",
    });
    const res = await withBridge(
      request("/api/capacity/summary", undefined, { "x-era-organization-id": ORG_TOKEN }),
    );
    assert.equal(forwarded(res, "x-era-organization-id"), ORG_TOKEN);
  });

  it("drops a client-sent org header on public pages", async () => {
    const res = await middleware(
      request("/login", undefined, { "x-era-organization-id": ORG_FORGED }),
    );
    assert.equal(forwarded(res, "x-era-organization-id"), null);
  });

  it("lets authorizeApi deny with the token org", async () => {
    let seenOrg: string | undefined;
    const frozen = createSatelliteStaffMiddleware({
      isPublicPage: (p) => p === "/login",
      authorizeApi: ({ session }) => {
        seenOrg = session.organizationId;
        return session.organizationId === ORG_TOKEN
          ? new Response(null, { status: 423 })
          : null;
      },
    });
    const res = await frozen(
      request("/api/folios", await token(ORG_TOKEN), { "x-era-organization-id": ORG_FORGED }),
    );
    assert.equal(seenOrg, ORG_TOKEN);
    assert.equal(res.status, 423);
  });
});
