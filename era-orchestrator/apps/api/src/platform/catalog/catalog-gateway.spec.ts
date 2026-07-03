import {
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CatalogGatewayService } from "./catalog-gateway.service";
import { SatelliteCatalogGuard } from "./satellite-catalog.guard";

describe("SatelliteCatalogGuard", () => {
  it("requires service token when configured", () => {
    const config = {
      get: (key: string) =>
        key === "SATELLITE_EVENT_SERVICE_TOKEN" ? "sat-secret" : undefined,
    } as unknown as ConfigService;
    const guard = new SatelliteCatalogGuard(config);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: "Bearer wrong" },
        }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });

  it("requires organization header", () => {
    const config = {
      get: () => undefined,
    } as unknown as ConfigService;
    const guard = new SatelliteCatalogGuard(config);
    const req = { headers: { authorization: "Bearer x" } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(
      BadRequestException,
    );
  });
});

describe("CatalogGatewayService.companyByVoen", () => {
  it("returns found:false for invalid voen", async () => {
    const service = new CatalogGatewayService(
      { get: () => "1" } as unknown as ConfigService,
      { getJson: async () => null } as never,
      { assertPlatformModule: async () => undefined } as never,
      { log: async () => undefined } as never,
    );
    const result = await service.companyByVoen("123", "org-1");
    expect(result.found).toBe(false);
  });
});
