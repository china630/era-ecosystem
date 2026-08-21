import * as path from "path";

/** Kit CJS entrypoints (avoid barrel → jose ESM under Jest). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertEnvServiceToken } = require(path.resolve(
  __dirname,
  "../../../../../packages/satellite-kit/dist/auth/assert-service-token.js",
)) as typeof import("@era/satellite-kit");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createOrganizationBindHandlers } = require(path.resolve(
  __dirname,
  "../../../../../packages/satellite-kit/dist/tenancy/organization-bind.js",
)) as {
  createOrganizationBindHandlers: typeof import("@era/satellite-kit").createOrganizationBindHandlers;
};

describe("Platform BIND negative paths (AC-CP-BIND)", () => {
  const prev = {
    token: process.env.SATELLITE_EVENT_SERVICE_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "bind-svc-token";
  });

  afterEach(() => {
    if (prev.token === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    else process.env.SATELLITE_EVENT_SERVICE_TOKEN = prev.token;
    if (prev.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev.nodeEnv;
  });

  it("assertEnvServiceToken denies bad token (401)", () => {
    const bad = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: "Bearer wrong",
    });
    expect(bad).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("POST /organization/bind returns 401 without Bearer", async () => {
    const { POST } = createOrganizationBindHandlers();
    const res = await POST(
      new Request("http://localhost/api/internal/v1/organization/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "00000000-0000-4000-8000-000000000001",
        }),
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("POST /organization/bind returns 401 for bad token", async () => {
    const { POST } = createOrganizationBindHandlers();
    const res = await POST(
      new Request("http://localhost/api/internal/v1/organization/bind", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong",
        },
        body: JSON.stringify({
          organizationId: "00000000-0000-4000-8000-000000000001",
        }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
