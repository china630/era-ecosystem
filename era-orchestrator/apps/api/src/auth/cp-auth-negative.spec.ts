import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";

function mockCtx(headers: Record<string, string | undefined>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  };
}

describe("Platform AUTH negative paths (AC-CP-AUTH)", () => {
  it("JwtAuthGuard returns 401 when Bearer is missing", async () => {
    const auth = { verifyAccessToken: jest.fn() };
    const reflector = { getAllAndOverride: () => false };
    const guard = new JwtAuthGuard(auth as never, reflector as never);
    await expect(guard.canActivate(mockCtx({}) as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("JwtAuthGuard returns 401 for invalid/expired token", async () => {
    const auth = {
      verifyAccessToken: jest.fn().mockRejectedValue(new Error("jwt expired")),
    };
    const reflector = { getAllAndOverride: () => false };
    const guard = new JwtAuthGuard(auth as never, reflector as never);
    await expect(
      guard.canActivate(
        mockCtx({ authorization: "Bearer not-a-valid-jwt" }) as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("ssoExchange rejects spoofed/bad SSO signature with 401", async () => {
    const config = {
      get: (key: string) =>
        key === "ERA_SSO_SHARED_SECRET" ? "unit-test-sso-secret" : undefined,
    };
    const prisma = {
      user: { findUnique: jest.fn() },
      organizationMembership: { findUnique: jest.fn() },
    };
    const svc = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      config as never,
      {} as never,
      {} as never,
    );
    await expect(
      svc.ssoExchange({
        email: "spoof@example.com",
        organizationId: "00000000-0000-4000-8000-000000000001",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        signature: "00".repeat(32),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
