import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";

function mockCtx(user: Record<string, unknown> | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

describe("Platform WF negative paths (AC-CP-WF)", () => {
  it("PermissionsGuard denies hire when api:workforce.hire missing (403)", () => {
    const reflector = {
      getAllAndOverride: () => [CP_PERMISSION.API_WORKFORCE_HIRE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(
        mockCtx({
          sub: "u1",
          role: "ADMIN",
          isSuperAdmin: false,
          isOwner: false,
          permissions: [CP_PERMISSION.API_WORKFORCE_READ],
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it("PermissionsGuard denies terminate when api:workforce.terminate stripped", () => {
    const reflector = {
      getAllAndOverride: () => [CP_PERMISSION.API_WORKFORCE_TERMINATE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(
        mockCtx({
          sub: "u1",
          role: "HR_MANAGER",
          isOwner: false,
          permissions: [
            CP_PERMISSION.API_WORKFORCE_READ,
            CP_PERMISSION.API_WORKFORCE_HIRE,
          ],
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it("assertWorkforceHub returns 403 when platform_workforce is not entitled", async () => {
    const subscriptionAccess = {
      hasModule: jest.fn().mockResolvedValue(false),
    };
    const entitlement = new WorkforceEntitlementService(
      subscriptionAccess as never,
    );
    await expect(
      entitlement.assertWorkforceHub("00000000-0000-4000-8000-000000000001"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PLATFORM_WORKFORCE_REQUIRED",
      }),
    });
    expect(subscriptionAccess.hasModule).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "platform_workforce",
    );
  });
});
