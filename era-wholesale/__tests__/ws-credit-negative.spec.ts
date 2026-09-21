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
    "FINANCE_INTERNAL_SERVICE_TOKEN",
    "SATELLITE_EVENT_SERVICE_TOKEN",
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

  describe("probeTradeCreditSku", () => {
    it("treats 402 TRADE_CREDIT_REQUIRED as SKU off", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ code: "TRADE_CREDIT_REQUIRED" }),
      }) as unknown as typeof fetch;
      const { probeTradeCreditSku, createTradeCreditRequestCache } = await import(
        "@/lib/credit-limit"
      );
      const cache = createTradeCreditRequestCache();
      const probe = await probeTradeCreditSku("cp-1", null, cache);
      expect(probe.status).toBe("off");
      expect(probe.skuEnabled).toBe(false);
      // cached
      const again = await probeTradeCreditSku("cp-1", null, cache);
      expect(again.status).toBe("off");
      expect(again.skuEnabled).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("returns facility snapshot when SKU on", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          creditLimit: 5000,
          available: 3200,
          stopList: false,
        }),
      }) as unknown as typeof fetch;
      const { probeTradeCreditSku } = await import("@/lib/credit-limit");
      const probe = await probeTradeCreditSku("cp-9", "Bearer t");
      expect(probe.status).toBe("on");
      expect(probe).toMatchObject({
        skuEnabled: true,
        facility: {
          creditLimit: 5000,
          available: 3200,
          stopList: false,
          source: "finance_trade_credit",
        },
      });
    });

    it("treats network fail as unknown", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as typeof fetch;
      const { probeTradeCreditSku } = await import("@/lib/credit-limit");
      const probe = await probeTradeCreditSku("cp-down", null);
      expect(probe.status).toBe("unknown");
      expect(probe.skuEnabled).toBe(false);
      expect(probe.facility).toBeNull();
    });

    it("treats 503 as unknown", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as unknown as typeof fetch;
      const { probeTradeCreditSku } = await import("@/lib/credit-limit");
      const probe = await probeTradeCreditSku("cp-503", null);
      expect(probe.status).toBe("unknown");
      expect(probe.skuEnabled).toBe(false);
      expect(probe.facility).toBeNull();
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
        available: 7500,
        stopList: false,
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
        available: 10000,
        stopList: false,
        currency: "AZN",
        source: "env_stub",
      });
    });

    it("returns facility view when trade credit SKU is on", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          creditLimit: 8000,
          available: 2500,
          stopList: true,
        }),
      }) as unknown as typeof fetch;
      const { GET } = await import("../app/api/credit-limit/route");
      const res = await GET(
        new Request("http://localhost/api/credit-limit?counterpartyId=cp-sku"),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        counterpartyId: "cp-sku",
        creditLimit: 8000,
        available: 2500,
        stopList: true,
        source: "finance_trade_credit",
      });
    });

    it("never leaks Finance policyGroup into credit-limit JSON", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          creditLimit: 8000,
          available: 2500,
          stopList: false,
          policyGroup: "D",
          policyGroupComputed: "D",
          policyReasons: ["max_dpd"],
          proposedLimit: 9000,
          proposedKind: "WORKING_CAPITAL",
          suggestedLimit: 8500,
          limitBeforeBlock: 5000,
        }),
      }) as unknown as typeof fetch;
      const { GET } = await import("../app/api/credit-limit/route");
      const res = await GET(
        new Request(
          "http://localhost/api/credit-limit?counterpartyId=cp-policy-leak",
        ),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        counterpartyId: "cp-policy-leak",
        creditLimit: 8000,
        available: 2500,
        stopList: false,
        source: "finance_trade_credit",
      });
      expect(body).not.toHaveProperty("policyGroup");
      expect(body).not.toHaveProperty("policyGroupComputed");
      expect(body).not.toHaveProperty("policyReasons");
      expect(body).not.toHaveProperty("proposedLimit");
      expect(body).not.toHaveProperty("proposedKind");
      expect(body).not.toHaveProperty("suggestedLimit");
      expect(body).not.toHaveProperty("limitBeforeBlock");
    });
  });

  describe("confirm on-account grant guard", () => {
    beforeEach(() => {
      jest.resetModules();
      jest.doMock("@/lib/prisma", () => ({
        prisma: {
          b2BOrder: {
            findUnique: jest.fn(),
            update: jest.fn(),
          },
        },
      }));
      jest.doMock("@/lib/request-organization", () => ({
        requestOrganizationId: jest.fn(() => "org-1"),
      }));
      jest.doMock("@/lib/dispatch-satellite-event", () => ({
        dispatchSatelliteEvent: jest.fn(),
      }));
      jest.doMock("@/lib/platform-notify", () => ({
        trySendPlatformNotification: jest.fn(),
      }));
      jest.doMock("@/integration/control-plane-platform.client", () => ({
        createPaymentLink: jest.fn(),
        createPortalLink: jest.fn(),
        createShipment: jest.fn(),
        createBookingSlot: jest.fn(),
        createPromotion: jest.fn(),
        createCustomDomain: jest.fn(),
      }));
    });

    it("returns 400 when on-account + SKU on and grantCode missing", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ creditLimit: 1000, available: 500, stopList: false }),
      }) as unknown as typeof fetch;

      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { b2BOrder: { findUnique: jest.Mock; update: jest.Mock } };
      };
      prisma.b2BOrder.findUnique.mockResolvedValue({
        id: "ord-1",
        status: "DRAFT",
        buyerCounterpartyId: "cp-1",
        amountNet: 100,
        paymentTermDays: 30,
        lineCount: 1,
        tradeCreditGrantId: null,
      });

      const { POST } = await import("../app/api/orders/[id]/confirm/route");
      const res = await POST(
        new Request("http://localhost/api/orders/ord-1/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        { params: Promise.resolve({ id: "ord-1" }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/grantCode/);
      expect(prisma.b2BOrder.update).not.toHaveBeenCalled();
    });

    it("returns 409 when Finance consume rejects the grant", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      process.env.FINANCE_INTERNAL_SERVICE_TOKEN = "svc-token";
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ creditLimit: 1000, available: 500, stopList: false }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ message: "Grant code not found" }),
        }) as unknown as typeof fetch;

      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { b2BOrder: { findUnique: jest.Mock; update: jest.Mock } };
      };
      prisma.b2BOrder.findUnique.mockResolvedValue({
        id: "ord-2",
        status: "DRAFT",
        buyerCounterpartyId: "cp-1",
        amountNet: 100,
        paymentTermDays: 14,
        lineCount: 1,
        tradeCreditGrantId: null,
      });

      const { POST } = await import("../app/api/orders/[id]/confirm/route");
      const res = await POST(
        new Request("http://localhost/api/orders/ord-2/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ grantCode: "ABCDEFGHJKLM" }),
        }),
        { params: Promise.resolve({ id: "ord-2" }) },
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/Grant code not found/);
      expect(prisma.b2BOrder.update).not.toHaveBeenCalled();
    });

    it("returns 503 when on-account and probe status is unknown", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockRejectedValue(new Error("facility down")) as typeof fetch;

      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { b2BOrder: { findUnique: jest.Mock; update: jest.Mock } };
      };
      prisma.b2BOrder.findUnique.mockResolvedValue({
        id: "ord-unk",
        status: "DRAFT",
        buyerCounterpartyId: "cp-1",
        amountNet: 100,
        paymentTermDays: 30,
        lineCount: 1,
        tradeCreditGrantId: null,
      });

      const { POST } = await import("../app/api/orders/[id]/confirm/route");
      const res = await POST(
        new Request("http://localhost/api/orders/ord-unk/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ grantCode: "ABCDEFGHJKLM" }),
        }),
        { params: Promise.resolve({ id: "ord-unk" }) },
      );
      expect(res.status).toBe(503);
      expect(prisma.b2BOrder.update).not.toHaveBeenCalled();
    });

    it("confirms without grant when SKU off (402 probe)", async () => {
      process.env.FINANCE_API_URL = "http://finance.test/api";
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ code: "TRADE_CREDIT_REQUIRED" }),
      }) as unknown as typeof fetch;

      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { b2BOrder: { findUnique: jest.Mock; update: jest.Mock } };
      };
      const draft = {
        id: "ord-3",
        status: "DRAFT",
        buyerCounterpartyId: "cp-1",
        amountNet: 50,
        paymentTermDays: 30,
        lineCount: 1,
        tradeCreditGrantId: null,
      };
      prisma.b2BOrder.findUnique.mockResolvedValue(draft);
      prisma.b2BOrder.update.mockResolvedValue({
        ...draft,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      });

      const { POST } = await import("../app/api/orders/[id]/confirm/route");
      const res = await POST(
        new Request("http://localhost/api/orders/ord-3/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        { params: Promise.resolve({ id: "ord-3" }) },
      );
      expect(res.status).toBe(200);
      expect(prisma.b2BOrder.update).toHaveBeenCalled();
    });
  });
});
