import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SatelliteCatalogGuard } from "./satellite-catalog.guard";

/**
 * AC-CP-INT negative: catalog gateway deny + CI gate
 * `npm run audit:integration:strict` (docs/INTEGRATION_AUDIT_CI.md).
 */
describe("Platform INT negative paths (AC-CP-INT)", () => {
  it("SatelliteCatalogGuard returns 401 when service token is wrong", () => {
    const config = {
      get: (key: string) =>
        key === "SATELLITE_EVENT_SERVICE_TOKEN" ? "sat-secret" : undefined,
    } as unknown as ConfigService;
    const guard = new SatelliteCatalogGuard(config);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: "Bearer wrong",
            "x-organization-id": "00000000-0000-4000-8000-000000000001",
          },
        }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });

  it("SatelliteCatalogGuard returns 401 when Bearer is missing and token is configured", () => {
    const config = {
      get: (key: string) =>
        key === "SATELLITE_EVENT_SERVICE_TOKEN" ? "sat-secret" : undefined,
    } as unknown as ConfigService;
    const guard = new SatelliteCatalogGuard(config);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-organization-id": "00000000-0000-4000-8000-000000000001",
          },
        }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });
});
