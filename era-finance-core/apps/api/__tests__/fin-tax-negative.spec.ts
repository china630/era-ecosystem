import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TaxpayerIntegrationService } from "../src/tax/taxpayer-integration.service";

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  quit: jest.fn(),
};

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => redisMock);
});

describe("Finance TAX negative paths (AC-FIN-TAX)", () => {
  function makeService() {
    const config = {
      get: jest.fn((k: string, d?: string) => {
        if (k === "REDIS_URL") return "redis://127.0.0.1:6379";
        return d;
      }),
    } as unknown as ConfigService;
    const reliability = {
      trackCache: jest.fn(),
      executeWithPolicies: jest.fn(),
    };
    const audit = { logOrganizationSystemEvent: jest.fn() };
    return new TaxpayerIntegrationService(
      config,
      reliability as never,
      audit as never,
    );
  }

  it("lookupTaxpayerByVoen refuses invalid VÖEN length", async () => {
    const service = makeService();
    await expect(service.lookupTaxpayerByVoen("123")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await service.lookupTaxpayerByVoen("12345");
    } catch (err) {
      expect((err as BadRequestException).message).toMatch(/10 digits/i);
    }
    await service.onModuleDestroy();
  });
});
