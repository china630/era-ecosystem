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
  };
});

describe("Wholesale credit negative paths (AC-WS-CREDIT)", () => {
  const originalFetch = global.fetch;
  const envKeys = [
    "FINANCE_API_URL",
    "FINANCE_API_TOKEN",
    "WHOLESALE_CREDIT_LIMIT_STUB",
    "WHOLESALE_CREDIT_LIMIT_OVERRIDES",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  describe("readCreditFromFinance", () => {
    it("returns null when Finance is down (fetch fails)", async () => {
      process.env.FINANCE_API_URL = "http://finance.test";
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as typeof fetch;
      const { readCreditFromFinance } = await import("@/lib/credit-limit");
      await expect(readCreditFromFinance("cp-1", null)).resolves.toBeNull();
    });

    it("returns null when Finance responds non-OK", async () => {
      process.env.FINANCE_API_URL = "http://finance.test";
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as unknown as typeof fetch;
      const { readCreditFromFinance } = await import("@/lib/credit-limit");
      await expect(readCreditFromFinance("cp-1", null)).resolves.toBeNull();
    });
  });

  describe("GET /api/credit-limit stub shape", () => {
    it("requires counterpartyId", async () => {
      const { GET } = await import("../app/api/credit-limit/route");
      const res = await GET(new Request("http://localhost/api/credit-limit"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/counterpartyId/);
    });

    it("returns explicit env_stub_fallback when Finance URL set but Finance down", async () => {
      process.env.FINANCE_API_URL = "http://finance.test";
      process.env.WHOLESALE_CREDIT_LIMIT_STUB = "7500";
      global.fetch = jest.fn().mockRejectedValue(new Error("down")) as typeof fetch;
      const { GET } = await import("../app/api/credit-limit/route");
      const res = await GET(
        new Request("http://localhost/api/credit-limit?counterpartyId=cp-42"),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        counterpartyId: "cp-42",
        creditLimit: 7500,
        currency: "AZN",
        source: "env_stub_fallback",
      });
      expect(body.source).not.toBe("finance_api");
    });

    it("returns explicit env_stub when Finance URL unset", async () => {
      process.env.WHOLESALE_CREDIT_LIMIT_STUB = "10000";
      const { GET } = await import("../app/api/credit-limit/route");
      const res = await GET(
        new Request("http://localhost/api/credit-limit?counterpartyId=cp-7"),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        counterpartyId: "cp-7",
        creditLimit: 10000,
        currency: "AZN",
        source: "env_stub",
      });
    });
  });
});
