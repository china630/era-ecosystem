jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {
    status = 403;
    moduleKey: string;
    constructor(moduleKey: string) {
      super(`Industry module not active: ${moduleKey}`);
      this.name = "IndustryModuleInactiveError";
      this.moduleKey = moduleKey;
    }
  }
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(),
    authCookieName: () => "era_session",
    getBearerOrCookieToken: jest.fn(() => null),
    verifySatelliteSession: jest.fn(),
    financeHsTariffPreview: jest.fn(),
    financeFxPreview: jest.fn(),
  };
});

describe("Logistics reference / customs negative paths (AC-LOG-REF)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("HS preview", () => {
    it("rejects HS code shorter than 4 chars", async () => {
      const { GET } = await import("../app/api/hs-preview/route");
      const res = await GET(
        new Request("http://localhost/api/hs-preview?code=12"),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Validation failed/);
    });

    it("surfaces Finance HS preview failure (not silent success)", async () => {
      const kit = jest.requireMock("@era/satellite-kit") as {
        financeHsTariffPreview: jest.Mock;
      };
      kit.financeHsTariffPreview.mockRejectedValue(
        new Error("HS preview unavailable"),
      );
      const { GET } = await import("../app/api/hs-preview/route");
      const res = await GET(
        new Request("http://localhost/api/hs-preview?code=8703"),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/HS preview unavailable/);
    });
  });

  describe("FX preview", () => {
    it("rejects missing from currency", async () => {
      const { GET } = await import("../app/api/fx-preview/route");
      const res = await GET(
        new Request("http://localhost/api/fx-preview?amount=100"),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Validation failed/);
    });

    it("surfaces Finance FX preview failure (not silent success)", async () => {
      const kit = jest.requireMock("@era/satellite-kit") as {
        financeFxPreview: jest.Mock;
      };
      kit.financeFxPreview.mockRejectedValue(
        new Error(
          "FX preview unavailable (orchestrator platform catalog — check ORCHESTRATOR_URL and SATELLITE_EVENT_SERVICE_TOKEN)",
        ),
      );
      const { GET } = await import("../app/api/fx-preview/route");
      const res = await GET(
        new Request("http://localhost/api/fx-preview?from=USD&amount=100"),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/FX preview unavailable/);
    });
  });
});
