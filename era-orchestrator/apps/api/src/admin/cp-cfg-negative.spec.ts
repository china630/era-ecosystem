import * as path from "path";
import { ConfigService } from "@nestjs/config";
import {
  SatelliteOrgBindSyncService,
  resolveSatelliteEventUrl,
} from "./satellite-org-bind-sync.service";

/** Kit CJS entrypoint (avoid barrel / jose ESM under Jest). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRuntimeConfigHandlers } = require(path.resolve(
  __dirname,
  "../../../../../packages/satellite-kit/dist/tenancy/runtime-config.js",
));

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
    const body = await res.json();
    expect(String(body.error ?? "")).toMatch(/ssoSharedSecret|at least 16/i);
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
      fiscalHardwareDevice: {
        findMany: jest.fn().mockResolvedValue([]),
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
    const body = await svc.buildRuntimeConfigPayload(orgId);
    expect(body.ssoSharedSecret).toBeUndefined();
  });

  it("Sync runtimeConfigPayload omits folklore event token and SSO", async () => {
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
      fiscalHardwareDevice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const config = {
      get: (key: string) => {
        if (key === "ERA_SSO_SHARED_SECRET") return "change-me-sso-hmac-secret";
        if (key === "SATELLITE_EVENT_SERVICE_TOKEN") {
          return "change-me-satellite-event-token_!@";
        }
        if (key === "ERA_PUBLIC_ORCHESTRATOR_URL") return "https://api.era-365.online";
        if (key === "ERA_ORCHESTRATOR_INTERNAL_URL") return "http://orchestrator:4000";
        return undefined;
      },
    } as unknown as ConfigService;
    const svc = new SatelliteOrgBindSyncService(
      prisma as never,
      {} as never,
      config,
    );
    const body = await svc.buildRuntimeConfigPayload(orgId);
    expect(body.ssoSharedSecret).toBeUndefined();
    expect(body.satelliteEventServiceToken).toBeUndefined();
    expect(body.orchestratorEventUrl).toBe("http://orchestrator:4000");
  });

  it("resolveSatelliteEventUrl uses docker DNS when ERA_IN_DOCKER even if public HTTPS is set", () => {
    expect(
      resolveSatelliteEventUrl({
        orchPublic: "https://api.era-365.online",
        eventPublicUrl: "https://api.era-365.online",
        inDocker: true,
      }),
    ).toBe("http://orchestrator:4000");
  });

  it("resolveSatelliteEventUrl ignores public ERA_ORCHESTRATOR_INTERNAL_URL in Docker", () => {
    expect(
      resolveSatelliteEventUrl({
        internalUrl: "https://api.era-365.online",
        inDocker: true,
      }),
    ).toBe("http://orchestrator:4000");
  });

  it("getDesiredState 404 when endpoint missing", async () => {
    const orgId = "00000000-0000-4000-8000-000000000001";
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: orgId }),
      },
      satelliteEndpoint: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const svc = new SatelliteOrgBindSyncService(
      prisma as never,
      {} as never,
      { get: () => undefined } as unknown as ConfigService,
    );
    await expect(
      svc.getDesiredState({
        organizationId: orgId,
        satelliteKey: "industry_hotel_pms",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("getDesiredState returns folklore-omitted config when endpoint enabled", async () => {
    const orgId = "00000000-0000-4000-8000-000000000001";
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgId,
          deploymentTopology: "DEDICATED",
          subscriptionPlan: null,
          publicOrgNumber: null,
          deletedAt: null,
          settings: null,
        }),
      },
      satelliteEndpoint: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
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
      fiscalHardwareDevice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const config = {
      get: (key: string) => {
        if (key === "ERA_SSO_SHARED_SECRET") return "change-me-sso-hmac-secret";
        if (key === "SATELLITE_EVENT_SERVICE_TOKEN") {
          return "dev-satellite-event-token";
        }
        if (key === "ERA_ORCHESTRATOR_INTERNAL_URL") return "http://orchestrator:4000";
        return undefined;
      },
    } as unknown as ConfigService;
    const svc = new SatelliteOrgBindSyncService(
      prisma as never,
      {} as never,
      config,
    );
    const res = await svc.getDesiredState({
      organizationId: orgId,
      satelliteKey: "industry_clinic",
    });
    expect(res.satelliteKey).toBe("industry_clinic");
    expect(res.config.ssoSharedSecret).toBeUndefined();
    expect(res.config.satelliteEventServiceToken).toBeUndefined();
    expect(res.config.updatedBy).toBe("orchestrator-desired-state");
  });
});
