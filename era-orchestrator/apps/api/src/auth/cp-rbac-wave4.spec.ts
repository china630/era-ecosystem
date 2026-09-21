import { UserRole } from "@era365/database";
import {
  CP_PERMISSION,
  DEFAULT_CP_ROLE_PERMISSIONS,
  effectiveCpRolePermissions,
  isLockedCpPermission,
  isAuditorCpRole,
  auditorDisallowedPermissions,
  permissionsJsonNeedsTemplate,
} from "./cp-permissions";
import { ensureSystemCpRoles } from "./ensure-system-cp-roles";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Reflector } from "@nestjs/core";
import type { EraJwtPayload } from "./jwt-payload.type";
import { ExecutionContext } from "@nestjs/common";

describe("CP Wave 4 permissions catalog", () => {
  it("honors valid empty permissionsJson", () => {
    expect(permissionsJsonNeedsTemplate("[]")).toBe(false);
    expect(effectiveCpRolePermissions(UserRole.ADMIN, "[]")).toEqual([]);
    expect(permissionsJsonNeedsTemplate("{broken")).toBe(true);
  });

  it("ADMIN template has workforce hire but not locked transfer", () => {
    const perms = DEFAULT_CP_ROLE_PERMISSIONS[UserRole.ADMIN];
    expect(perms).toContain(CP_PERMISSION.API_WORKFORCE_HIRE);
    expect(perms).not.toContain(CP_PERMISSION.API_ORG_TRANSFER_OWNERSHIP);
    expect(isLockedCpPermission(CP_PERMISSION.API_ORG_TRANSFER_OWNERSHIP)).toBe(
      true,
    );
  });

  it("AUDITOR template is read-only and extra write keys are disallowed", () => {
    const perms = DEFAULT_CP_ROLE_PERMISSIONS[UserRole.AUDITOR];
    expect(perms).not.toContain(CP_PERMISSION.API_WORKFORCE_HIRE);
    expect(perms).not.toContain(CP_PERMISSION.API_ORG_MEMBERS_WRITE);
    expect(perms).not.toContain(CP_PERMISSION.API_LEDGER_POST);
    expect(perms).toContain(CP_PERMISSION.API_REPORTS_NAS);
    expect(isAuditorCpRole("AUDITOR", null)).toBe(true);
    expect(isAuditorCpRole("CHECKER", "AUDITOR")).toBe(true);
    expect(isAuditorCpRole("ADMIN", null)).toBe(false);
    expect(
      auditorDisallowedPermissions([
        CP_PERMISSION.API_LEDGER_READ,
        CP_PERMISSION.API_LEDGER_POST,
      ]),
    ).toEqual([CP_PERMISSION.API_LEDGER_POST]);
  });
});

describe("ensureSystemCpRoles", () => {
  function makeDb(
    seed: Array<{ code: string; permissionsJson: string }>,
  ) {
    const store = new Map(
      seed.map((r) => [
        r.code,
        {
          id: `id-${r.code}`,
          organizationId: "org-1",
          code: r.code,
          name: r.code,
          permissionsJson: r.permissionsJson,
          isSystem: false,
          cloneFromCode: null,
        },
      ]),
    );
    return {
      organizationRole: {
        findFirst: jest.fn(async ({ where }: { where: { code: string } }) => {
          return store.get(where.code) ?? null;
        }),
        create: jest.fn(
          async ({
            data,
          }: {
            data: { code: string; permissionsJson: string; name: string };
          }) => {
            const row = {
              id: `id-${data.code}`,
              organizationId: "org-1",
              isSystem: true,
              cloneFromCode: null,
              ...data,
            };
            store.set(data.code, row);
            return row;
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const found = [...store.values()].find((r) => r.id === where.id);
            if (!found) throw new Error("missing");
            Object.assign(found, data);
            return found;
          },
        ),
      },
      store,
    };
  }

  it("does not refill intentional empty JSON", async () => {
    const db = makeDb([
      { code: UserRole.HR_MANAGER, permissionsJson: "[]" },
    ]);
    await ensureSystemCpRoles(db as never, "org-1");
    expect(db.store.get(UserRole.HR_MANAGER)!.permissionsJson).toBe("[]");
  });

  it("fills invalid JSON from template", async () => {
    const db = makeDb([
      { code: UserRole.HR_MANAGER, permissionsJson: "{broken" },
    ]);
    await ensureSystemCpRoles(db as never, "org-1");
    const row = db.store.get(UserRole.HR_MANAGER)!;
    expect(JSON.parse(row.permissionsJson).length).toBeGreaterThan(0);
  });
});

describe("PermissionsGuard Wave 4", () => {
  function ctx(user: Partial<EraJwtPayload> | undefined, required: string[]) {
    const reflector = {
      getAllAndOverride: () => required,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const execution = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
    return { guard, execution };
  }

  it("OWNER isOwner bypasses missing hire key", () => {
    const { guard, execution } = ctx(
      {
        sub: "u1",
        email: "o@x",
        role: UserRole.OWNER,
        isOwner: true,
        permissions: [],
      },
      [CP_PERMISSION.API_WORKFORCE_HIRE],
    );
    expect(guard.canActivate(execution)).toBe(true);
  });

  it("ADMIN without hire is denied", () => {
    const stripped = DEFAULT_CP_ROLE_PERMISSIONS[UserRole.ADMIN].filter(
      (p) => p !== CP_PERMISSION.API_WORKFORCE_HIRE,
    );
    const { guard, execution } = ctx(
      {
        sub: "u1",
        email: "a@x",
        role: UserRole.ADMIN,
        isOwner: false,
        permissions: stripped,
      },
      [CP_PERMISSION.API_WORKFORCE_HIRE],
    );
    expect(() => guard.canActivate(execution)).toThrow(/Missing permission/);
  });

  it("undefined JWT permissions fail-closed", () => {
    const { guard, execution } = ctx(
      {
        sub: "u1",
        email: "a@x",
        role: UserRole.ADMIN,
        isOwner: false,
      },
      [CP_PERMISSION.SCREEN_WORKSPACE_HOME],
    );
    expect(() => guard.canActivate(execution)).toThrow(/Missing permission/);
  });

  it("HR_MANAGER with hire passes", () => {
    const { guard, execution } = ctx(
      {
        sub: "u1",
        email: "h@x",
        role: UserRole.HR_MANAGER,
        isOwner: false,
        permissions: [...DEFAULT_CP_ROLE_PERMISSIONS[UserRole.HR_MANAGER]],
      },
      [CP_PERMISSION.API_WORKFORCE_HIRE],
    );
    expect(guard.canActivate(execution)).toBe(true);
  });

  it("DEPARTMENT_HEAD cannot bootstrap or terminate", () => {
    const perms = DEFAULT_CP_ROLE_PERMISSIONS[UserRole.DEPARTMENT_HEAD];
    expect(perms).not.toContain(CP_PERMISSION.API_WORKFORCE_BOOTSTRAP);
    expect(perms).not.toContain(CP_PERMISSION.API_WORKFORCE_TERMINATE);
    expect(perms).not.toContain(CP_PERMISSION.API_WORKFORCE_ORG);
    expect(isLockedCpPermission(CP_PERMISSION.API_WORKFORCE_BOOTSTRAP)).toBe(
      true,
    );
  });
});
