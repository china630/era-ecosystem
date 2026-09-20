import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import { AuditorMutationGuard } from "../../src/auth/guards/auditor-mutation.guard";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";
import { InventoryAuditController } from "../../src/inventory/inventory-audit.controller";
import { InventoryReconciliationController } from "../../src/inventory/inventory-reconciliation.controller";
import { ManualAdjustmentController } from "../../src/accounting/manual-adjustment.controller";
import { PayrollController } from "../../src/hr/payroll.controller";

function mockHttpContext(params: {
  method: string;
  path: string;
  role?: UserRole;
  permissions?: string[];
  isOwner?: boolean;
  handler: (...args: unknown[]) => unknown;
  controllerClass: new (...args: unknown[]) => unknown;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: params.method,
        path: params.path,
        originalUrl: params.path,
        user:
          params.role == null
            ? undefined
            : {
                role: params.role,
                userId: "u-1",
                organizationId: "o-1",
                permissions: params.permissions,
                isOwner: params.isOwner,
              },
      }),
    }),
    getHandler: () => params.handler,
    getClass: () => params.controllerClass,
  } as unknown as ExecutionContext;
}

describe("RBAC Bridge Sprint P1 (Wave 5 permissions)", () => {
  it("PROCUREMENT is denied inventory reconciliation complete (missing inventory.approve)", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(PermissionsGuard);

    const ctx = mockHttpContext({
      method: "POST",
      path: "/api/inventory/reconciliations/a1/complete",
      role: UserRole.PROCUREMENT,
      permissions: [CP_PERMISSION.API_PURCHASES_MANAGE],
      handler: InventoryReconciliationController.prototype.complete,
      controllerClass: InventoryReconciliationController,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("ACCOUNTANT stripped of api:ledger.post is denied journal post", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(PermissionsGuard);

    const ctx = mockHttpContext({
      method: "POST",
      path: "/api/accounting/manual-adjustments",
      role: UserRole.ACCOUNTANT,
      permissions: [
        CP_PERMISSION.API_LEDGER_READ,
        CP_PERMISSION.API_REPORTS_NAS,
      ],
      handler: ManualAdjustmentController.prototype.create,
      controllerClass: ManualAdjustmentController,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("HR_MANAGER with hr_card only is denied payroll money endpoints", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(PermissionsGuard);

    const ctx = mockHttpContext({
      method: "POST",
      path: "/api/hr/payroll/runs",
      role: UserRole.HR_MANAGER,
      permissions: [CP_PERMISSION.API_PAYROLL_HR_CARD],
      handler: PayrollController.prototype.createRun,
      controllerClass: PayrollController,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("isOwner bypasses PermissionsGuard", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(PermissionsGuard);

    const ctx = mockHttpContext({
      method: "POST",
      path: "/api/accounting/manual-adjustments",
      role: UserRole.USER,
      permissions: [],
      isOwner: true,
      handler: ManualAdjustmentController.prototype.create,
      controllerClass: ManualAdjustmentController,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("non-owner empty permissions[] fail-closed (no template refill)", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(PermissionsGuard);

    const ctx = mockHttpContext({
      method: "POST",
      path: "/api/accounting/manual-adjustments",
      role: UserRole.ACCOUNTANT,
      permissions: [],
      handler: ManualAdjustmentController.prototype.create,
      controllerClass: ManualAdjustmentController,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("AUDITOR still blocked by AuditorMutationGuard belt", () => {
    const guard = new AuditorMutationGuard();
    const ctx = mockHttpContext({
      method: "PATCH",
      path: "/api/hr/absences/a1",
      role: UserRole.AUDITOR,
      permissions: [CP_PERMISSION.API_LEDGER_POST],
      handler: () => undefined,
      controllerClass: InventoryAuditController,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
