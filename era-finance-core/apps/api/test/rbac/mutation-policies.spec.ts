import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import { PERMISSIONS_KEY } from "../../src/common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";
import { AccountingController } from "../../src/accounting/accounting.controller";
import { OrganizationSettingsController } from "../../src/organizations/organization-settings.controller";
import { IntegrationsHealthController } from "../../src/integrations/integrations-health.controller";
import { AdminController } from "../../src/admin/admin.controller";
import { SuperAdminGuard } from "../../src/auth/guards/super-admin.guard";

function ctx(
  role: UserRole,
  handler: (...args: unknown[]) => unknown,
  klass: new (...args: unknown[]) => unknown,
  extra?: { permissions?: string[]; isOwner?: boolean },
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          role,
          userId: "u-1",
          organizationId: "o-1",
          permissions: extra?.permissions,
          isOwner: extra?.isOwner,
        },
      }),
    }),
    getHandler: () => handler,
    getClass: () => klass,
  } as any;
}

describe("RBAC mutation policy enforcement (PermissionsGuard)", () => {
  const guard = new PermissionsGuard(new Reflector());

  it("denies USER for accounting mutation (no api:ledger.post)", () => {
    expect(() =>
      guard.canActivate(
        ctx(
          UserRole.USER,
          AccountingController.prototype.quickExpense,
          AccountingController,
          { permissions: [] },
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it("denies USER for organization settings mutation", () => {
    expect(() =>
      guard.canActivate(
        ctx(
          UserRole.USER,
          OrganizationSettingsController.prototype.patchSettings,
          OrganizationSettingsController,
          { permissions: [] },
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it("denies USER for period lock mutation", () => {
    expect(() =>
      guard.canActivate(
        ctx(
          UserRole.USER,
          OrganizationSettingsController.prototype.patchPeriodLock,
          OrganizationSettingsController,
          { permissions: [] },
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows ACCOUNTANT for period lock when grant includes api:ledger.period_close", () => {
    expect(
      guard.canActivate(
        ctx(
          UserRole.ACCOUNTANT,
          OrganizationSettingsController.prototype.patchPeriodLock,
          OrganizationSettingsController,
          { permissions: [CP_PERMISSION.API_LEDGER_PERIOD_CLOSE] },
        ),
      ),
    ).toBe(true);
  });

  it("denies ACCOUNTANT for period lock when CP stripped period_close", () => {
    expect(() =>
      guard.canActivate(
        ctx(
          UserRole.ACCOUNTANT,
          OrganizationSettingsController.prototype.patchPeriodLock,
          OrganizationSettingsController,
          { permissions: [CP_PERMISSION.API_LEDGER_POST] },
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it("integrations health requires api:billing.manage (owner bypass)", () => {
    const handlerPerms = Reflect.getMetadata(
      PERMISSIONS_KEY,
      IntegrationsHealthController.prototype.health,
    ) as string[] | undefined;
    const classPerms = Reflect.getMetadata(
      PERMISSIONS_KEY,
      IntegrationsHealthController,
    ) as string[] | undefined;
    expect(handlerPerms ?? classPerms).toEqual([
      CP_PERMISSION.API_BILLING_MANAGE,
    ]);
  });

  it("admin controller stays super-admin protected", () => {
    const guards = Reflect.getMetadata("__guards__", AdminController) as
      | Array<new (...args: unknown[]) => unknown>
      | undefined;
    expect(Array.isArray(guards)).toBe(true);
    expect(guards?.some((g) => g === SuperAdminGuard)).toBe(true);
  });

  it("missing permissions claim fail-closes even for ACCOUNTANT donor", () => {
    expect(() =>
      guard.canActivate(
        ctx(
          UserRole.ACCOUNTANT,
          AccountingController.prototype.quickExpense,
          AccountingController,
        ),
      ),
    ).toThrow(ForbiddenException);
  });
});
