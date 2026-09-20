import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";
import { PERMISSIONS_KEY } from "../../src/common/decorators/permissions.decorator";

function mockExecutionContext(
  method: string,
  path: string,
  req: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        originalUrl: path,
        ...req,
      }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard + audit engagement guest", () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    guard = moduleRef.get(PermissionsGuard);
    reflector = moduleRef.get(Reflector);
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: unknown) => {
        if (key === PERMISSIONS_KEY) {
          return [CP_PERMISSION.API_REPORTS_NAS];
        }
        return undefined;
      });
  });

  it("allows GET /api/audit-hub/summary for non-admin when engagement headers resolved", () => {
    const ctx = mockExecutionContext("GET", "/api/audit-hub/summary", {
      user: {
        role: UserRole.HR_MANAGER,
        userId: "u1",
        email: "a@b.c",
        permissions: [],
      },
      auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
      auditEngagementInvitePermissions: { auditHubRead: true },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows GET /api/activity/invoice/... for guest read", () => {
    const ctx = mockExecutionContext(
      "GET",
      "/api/activity/invoice/00000000-0000-0000-0000-000000000001",
      {
        user: {
          role: UserRole.HR_MANAGER,
          userId: "u1",
          email: "a@b.c",
          permissions: [],
        },
        auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
        auditEngagementInvitePermissions: { auditHubRead: true },
      },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("denies GET /api/audit-hub/summary when engagement read disabled", () => {
    const ctx = mockExecutionContext("GET", "/api/audit-hub/summary", {
      user: {
        role: UserRole.HR_MANAGER,
        userId: "u1",
        email: "a@b.c",
        permissions: [],
      },
      auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
      auditEngagementInvitePermissions: { auditHubRead: false },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("denies non-GET audit-hub for guest without grant", () => {
    const ctx = mockExecutionContext("POST", "/api/audit-hub/sampling", {
      user: {
        role: UserRole.HR_MANAGER,
        userId: "u1",
        email: "a@b.c",
        permissions: [],
      },
      auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
      auditEngagementInvitePermissions: { auditHubRead: true },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
