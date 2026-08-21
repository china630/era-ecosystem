jest.mock("@era/satellite-kit", () => {
  // Use real fail-closed token helper without loading jose via kit barrel.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { assertEnvServiceToken } = require("../../packages/satellite-kit/dist/auth/assert-service-token.js");
  return {
    assertEnvServiceToken,
    publishToOrchestratorGateway: jest.fn(),
    satelliteOrganizationId: jest.fn(() => "org-test"),
    authCookieName: () => "era_session",
    getBearerOrCookieToken: jest.fn(() => null),
    verifySatelliteSession: jest.fn(),
    requireSatelliteModule: jest.fn(),
    platformNotificationsEnabled: jest.fn(() => false),
    trySendPlatformNotification: jest.fn(),
  };
});

describe("Logistics platform hooks negative paths (AC-LOG-PLAT)", () => {
  const savedToken = process.env.SATELLITE_EVENT_SERVICE_TOKEN;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (savedToken === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    else process.env.SATELLITE_EVENT_SERVICE_TOKEN = savedToken;
  });

  describe("events/dispatch service token", () => {
    it("denies when service token is not configured", async () => {
      delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
      const { POST } = await import("../app/api/events/dispatch/route");
      const res = await POST(
        new Request("http://localhost/api/events/dispatch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "SATELLITE_LOGISTICS_TRIP_COMPLETED" }),
        }),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/Service token not configured|Unauthorized/);
    });

    it("denies when Bearer token does not match", async () => {
      process.env.SATELLITE_EVENT_SERVICE_TOKEN = "expected-secret";
      const { POST } = await import("../app/api/events/dispatch/route");
      const res = await POST(
        new Request("http://localhost/api/events/dispatch", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer wrong-token",
          },
          body: JSON.stringify({ type: "SATELLITE_LOGISTICS_TRIP_COMPLETED" }),
        }),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/Unauthorized/);
    });
  });

  describe("platformNotificationsEnabled", () => {
    it("is false without orchestrator token (soft-skip, not silent success)", async () => {
      const kit = jest.requireMock("@era/satellite-kit") as {
        platformNotificationsEnabled: jest.Mock;
      };
      kit.platformNotificationsEnabled.mockReturnValue(false);
      const { platformNotificationsEnabled } = await import("@/lib/platform-notify");
      expect(platformNotificationsEnabled()).toBe(false);
    });
  });
});
