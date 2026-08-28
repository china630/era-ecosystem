import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { SatelliteOrgBindSyncService } from "./satellite-org-bind-sync.service";

/** Kit CJS entrypoint (avoid barrel → jose ESM under Jest). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRuntimeConfigHandlers } = require(path.resolve(
  __dirname,
  "../../../../../packages/satellite-kit/dist/tenancy/runtime-config.js",
)) as {
  createRuntimeConfigHandlers: typeof import("@era/satellite-kit").createRuntimeConfigHandlers;
};

describe("Platform CFG negative paths (AC-CP-CFG)", () => {
  const prev = {
    token: process.env.SATELLITE_EVENT_SERVICE_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "cfg-svc-token";
  });

  afterEach(() => {
    if (prev.token === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    else process.env.SATELLITE_EVENT_SERVICE_TOKEN = prev.token;
    if (prev.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev.nodeEnv;
  });

  it("POST /runtime-config returns 401 without Bearer", async () => {
    const { POST } = createRuntimeConfigHandlers();
    const res = await POST(
      new Request("http://localhost/api/internal/v1/runtime-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updatedBy: "unit-test" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects short SSO shared secret (<16) with 400", async () => {
    const { POST } = createRuntimeConfigHandlers();
    const res = await POST(
      new Request("http://localhost/api/internal/v1/runtime-config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cfg-svc-token",
        },
        body: JSON.stringify({ ssoSharedSecret: "too-short" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error ?? "").toMatch(/ssoSharedSecret|at least 16/i);
  });

  it("Sync runtimeConfigPayload omits SSO secret shorter than 16 chars", async () => {
    const orgId = "00000000-0000-4000-8000-000000000001";
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          deploymentTopology: "DEDICATED",
          subscriptionPlan: null,
        }),
      },
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      elektrawebBridgePolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      clinicCutoverPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const config = {
      get: (key: string) => {
        if (key === "ERA_SSO_SHARED_SECRET") return "short";
        if (key === "SATELLITE_EVENT_SERVICE_TOKEN") return "cfg-svc-token";
        return undefined;
      },
    } as unknown as ConfigService;
    const svc = new SatelliteOrgBindSyncService(
      prisma as never,
      {} as never,
      config,
    );
    const body = await (
      svc as unknown as {
        runtimeConfigPayload: (
          id: string,
        ) => Promise<Record<string, unknown>>;
      }
    ).runtimeConfigPayload(orgId);
    expect(body.ssoSharedSecret).toBeUndefined();
  });
});
