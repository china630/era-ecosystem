import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DisputeFreezeGuard } from "./dispute-freeze.guard";
import type { TenantPrismaRawService } from "../prisma/tenant-prisma-raw.service";
import { getTenantContext } from "../prisma/tenant-context";

function ctx(req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guardWithMode(mode: string | null) {
  const queryRaw = jest.fn(async () => {
    expect(getTenantContext()).toBeUndefined();
    return mode ? [{ mode }] : [];
  });
  const raw = { $queryRaw: queryRaw } as unknown as TenantPrismaRawService;
  const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
  return { guard: new DisputeFreezeGuard(raw, reflector), queryRaw };
}

describe("DisputeFreezeGuard", () => {
  const user = { organizationId: "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b" };

  it("reads the security row by JWT org without tenant ALS", async () => {
    const { guard, queryRaw } = guardWithMode(null);
    await expect(
      guard.canActivate(ctx({ method: "GET", originalUrl: "/api/fx/rates", user })),
    ).resolves.toBe(true);
    expect(queryRaw).toHaveBeenCalledWith(user.organizationId, expect.anything());
  });

  it("allows reads and blocks writes under HARD_BLOCK_PLATFORM", async () => {
    const { guard } = guardWithMode("HARD_BLOCK_PLATFORM");
    await expect(
      guard.canActivate(ctx({ method: "GET", originalUrl: "/api/reporting/dashboard", user })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(ctx({ method: "POST", originalUrl: "/api/invoices", user })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("freezes DELETE during a dispute", async () => {
    const { guard } = guardWithMode("DISPUTE");
    await expect(
      guard.canActivate(ctx({ method: "DELETE", originalUrl: "/api/invoices/1", user })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("skips auth routes without a DB read", async () => {
    const { guard, queryRaw } = guardWithMode("DISPUTE");
    await expect(
      guard.canActivate(ctx({ method: "POST", originalUrl: "/api/auth/logout", user })),
    ).resolves.toBe(true);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
