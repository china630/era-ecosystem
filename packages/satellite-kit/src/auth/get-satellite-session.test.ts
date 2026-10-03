import assert from "node:assert/strict";
import { describe, it, before, beforeEach } from "node:test";
import { readSatelliteStaffSession } from "./get-satellite-session";
import { signSatelliteSession } from "./session";

const ORG_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_HEADER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COOKIE = "era_test_session";

function cookieBag(token?: string) {
  return {
    get(name: string) {
      return name === COOKIE && token ? { value: token } : undefined;
    },
  };
}

function headerBag(values: Record<string, string> = {}) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

type Row = { organizationId: string | null; active: boolean; role: string };

describe("readSatelliteStaffSession", () => {
  const entered: (string | undefined)[] = [];
  const loads: { sub: string; enteredBefore: number }[] = [];

  before(() => {
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars";
  });

  beforeEach(() => {
    entered.length = 0;
    loads.length = 0;
  });

  async function token(organizationId?: string) {
    return signSatelliteSession({
      sub: "user-1",
      login: "reception",
      role: "STAFF",
      fullName: "Reception",
      organizationId,
    });
  }

  function run(opts: {
    token?: string;
    headers?: Record<string, string>;
    row?: Row | null;
  }) {
    return readSatelliteStaffSession<Row>({
      cookies: cookieBag(opts.token),
      headers: headerBag(opts.headers),
      cookieName: COOKIE,
      loadUser: async (session) => {
        loads.push({ sub: session.sub, enteredBefore: entered.length });
        return opts.row ?? null;
      },
      enterTenant: (ctx) => entered.push(ctx.organizationId),
    });
  }

  const activeRow: Row = { organizationId: ORG_TOKEN, active: true, role: "STAFF" };

  it("takes the org from the token and loads the user inside that tenant", async () => {
    const result = await run({
      token: await token(ORG_TOKEN),
      headers: { "x-era-organization-id": ORG_HEADER },
      row: activeRow,
    });
    assert.equal(result?.session.organizationId, ORG_TOKEN);
    assert.equal(result?.user.role, "STAFF");
    assert.deepEqual(entered, [ORG_TOKEN]);
    assert.deepEqual(loads, [{ sub: "user-1", enteredBefore: 1 }]);
  });

  it("ignores the org header when the token has no org", async () => {
    const result = await run({
      token: await token(),
      headers: { "x-era-organization-id": ORG_HEADER },
      row: activeRow,
    });
    assert.equal(result, null);
    assert.deepEqual(entered, []);
    assert.deepEqual(loads, []);
  });

  it("ignores the process bind when the token has no org", async () => {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = ORG_TOKEN;
    try {
      assert.equal(await run({ token: await token(), row: activeRow }), null);
      assert.deepEqual(entered, []);
    } finally {
      delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    }
  });

  it("returns null when the user row is missing", async () => {
    assert.equal(await run({ token: await token(ORG_TOKEN), row: null }), null);
  });

  it("returns null for an inactive user", async () => {
    const result = await run({
      token: await token(ORG_TOKEN),
      row: { ...activeRow, active: false },
    });
    assert.equal(result, null);
  });

  it("returns null when the user row belongs to another org", async () => {
    const result = await run({
      token: await token(ORG_TOKEN),
      row: { ...activeRow, organizationId: ORG_OTHER },
    });
    assert.equal(result, null);
  });

  it("returns null without a token or with a bad signature", async () => {
    assert.equal(await run({}), null);
    assert.equal(await run({ token: "not-a-jwt" }), null);
    assert.deepEqual(entered, []);
  });
});
