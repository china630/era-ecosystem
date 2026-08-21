import {
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InternalServiceTokenGuard } from "../src/common/guards/internal-service-token.guard";

function mockCtx(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

function mockConfig(token: string | undefined): ConfigService {
  return {
    get: (key: string) =>
      key === "FINANCE_INTERNAL_SERVICE_TOKEN" ? token : undefined,
  } as unknown as ConfigService;
}

describe("Finance event/internal ingress negative paths (AC-FIN-EVT)", () => {
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  it("InternalServiceTokenGuard returns 401 without Bearer when token configured", () => {
    process.env.NODE_ENV = "test";
    const guard = new InternalServiceTokenGuard(mockConfig("expected-event-token"));
    expect(() => guard.canActivate(mockCtx())).toThrow(UnauthorizedException);
    try {
      guard.canActivate(mockCtx());
    } catch (err) {
      expect((err as UnauthorizedException).message).toMatch(/Invalid internal service token/i);
    }
  });

  it("InternalServiceTokenGuard returns 401 when Bearer does not match", () => {
    process.env.NODE_ENV = "test";
    const guard = new InternalServiceTokenGuard(mockConfig("expected-event-token"));
    expect(() =>
      guard.canActivate(mockCtx("Bearer wrong-token")),
    ).toThrow(UnauthorizedException);
  });

  it("InternalServiceTokenGuard fails closed in production when token unset", () => {
    process.env.NODE_ENV = "production";
    const guard = new InternalServiceTokenGuard(mockConfig(undefined));
    expect(() => guard.canActivate(mockCtx("Bearer anything"))).toThrow(
      UnauthorizedException,
    );
  });
});
