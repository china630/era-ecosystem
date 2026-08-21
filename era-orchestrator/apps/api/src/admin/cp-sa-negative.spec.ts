import { ForbiddenException } from "@nestjs/common";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";

function mockCtx(user: Record<string, unknown> | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

describe("Platform SA negative paths (AC-CP-SA)", () => {
  it("SuperAdminGuard returns 403 for non-super-admin JWT", () => {
    const guard = new SuperAdminGuard();
    expect(() =>
      guard.canActivate(
        mockCtx({
          sub: "u1",
          email: "owner@example.com",
          isSuperAdmin: false,
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it("SuperAdminGuard returns 403 when user claim is missing", () => {
    const guard = new SuperAdminGuard();
    expect(() => guard.canActivate(mockCtx(undefined) as never)).toThrow(
      ForbiddenException,
    );
  });
});
