import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@era365/database";
import { RolesGuard } from "../../common/guards/roles.guard";
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
  it("RolesGuard denies hire when role is not OWNER/HR_MANAGER (403)", () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.OWNER, UserRole.HR_MANAGER],
    };
    const guard = new RolesGuard(reflector as never);
    expect(() =>
      guard.canActivate(
        mockCtx({
          sub: "u1",
          role: UserRole.ACCOUNTANT,
          isSuperAdmin: false,
          permissions: [],
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
