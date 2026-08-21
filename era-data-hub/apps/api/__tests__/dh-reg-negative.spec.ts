import {
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiKeyGuard } from "../src/auth/api-key.guard";
import { RegistryAuthGuard } from "../src/auth/registry-auth.guard";
import { ServiceTokenGuard } from "../src/auth/service-token.guard";

function mockCtx(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

function mockConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe("Data Hub REG negative paths (AC-DH-REG)", () => {
  it("returns 401 UNAUTHORIZED when neither API key nor service token present", async () => {
    const config = mockConfig({
      DATA_HUB_SERVICE_TOKEN: "svc-token",
      PLATFORM_REFERENCE_DATA_MODE: "mvp",
      DATA_HUB_DEV_API_KEYS: "dev-data-hub-key",
    });
    const guard = new RegistryAuthGuard(
      new ApiKeyGuard(config),
      new ServiceTokenGuard(config),
    );
    await expect(guard.canActivate(mockCtx({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    try {
      await guard.canActivate(mockCtx({}));
    } catch (err) {
      const body = (err as UnauthorizedException).getResponse() as {
        code: string;
        message: string;
      };
      expect(body.code).toBe("UNAUTHORIZED");
      expect(body.message).toMatch(/X-Api-Key|service Bearer/i);
    }
  });

  it("rejects invalid API key in mvp mode", async () => {
    const config = mockConfig({
      DATA_HUB_SERVICE_TOKEN: "svc-token",
      PLATFORM_REFERENCE_DATA_MODE: "mvp",
      DATA_HUB_DEV_API_KEYS: "dev-data-hub-key",
    });
    const apiKey = new ApiKeyGuard(config);
    await expect(
      apiKey.canActivate(mockCtx({ "x-api-key": "wrong-key" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    try {
      await apiKey.canActivate(mockCtx({ "x-api-key": "wrong-key" }));
    } catch (err) {
      const body = (err as UnauthorizedException).getResponse() as { code: string };
      expect(body.code).toBe("INVALID_API_KEY");
    }
  });
});
