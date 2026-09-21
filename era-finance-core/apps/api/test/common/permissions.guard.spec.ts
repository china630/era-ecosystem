import "reflect-metadata";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";
import { PERMISSIONS_KEY } from "../../src/common/decorators/permissions.decorator";

function httpCtx(
  user?: Record<string, unknown>,
  extra?: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        originalUrl: "/api/accounting/journal",
        user,
        ...(extra ?? {}),
      }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard (Wave 5 door)", () => {
  const guard = new PermissionsGuard({
    getAllAndOverride: (key: unknown) =>
      key === PERMISSIONS_KEY ? [CP_PERMISSION.API_LEDGER_POST] : undefined,
  } as unknown as Reflector);

  it("allows when JWT permissions include the required key", () => {
    expect(
      guard.canActivate(
        httpCtx({
          role: UserRole.USER,
          userId: "u-1",
          permissions: [CP_PERMISSION.API_LEDGER_POST],
        }),
      ),
    ).toBe(true);
  });

  it("fail-closes on empty permissions[] even for ACCOUNTANT donor", () => {
    expect(() =>
      guard.canActivate(
        httpCtx({
          role: UserRole.ACCOUNTANT,
          userId: "u-1",
          permissions: [],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("fail-closes when permissions claim is missing (no donor template)", () => {
    expect(() =>
      guard.canActivate(
        httpCtx({
          role: UserRole.ACCOUNTANT,
          userId: "u-1",
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("isOwner bypasses stripped grants", () => {
    expect(
      guard.canActivate(
        httpCtx({
          role: UserRole.USER,
          userId: "u-1",
          permissions: [],
          isOwner: true,
        }),
      ),
    ).toBe(true);
  });

  it("isSuperAdmin bypasses stripped grants", () => {
    expect(
      guard.canActivate(
        httpCtx({
          role: UserRole.USER,
          userId: "u-1",
          permissions: [],
          isSuperAdmin: true,
        }),
      ),
    ).toBe(true);
  });

  it("throws when user is missing", () => {
    expect(() => guard.canActivate(httpCtx())).toThrow(ForbiddenException);
  });
});
